import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import dotenv from 'dotenv';
import { pool, initializeDatabaseWithRetry } from './db';
import { encrypt, decrypt } from './utils/crypto';
import { getProviderConfig, UnifiedRequest, UnifiedMessage } from './provider_dictionary';
import { getEncoding } from 'js-tiktoken';

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const adminUser = process.env.ADMIN_USERNAME || 'asadiabdullah';
const adminPass = process.env.ADMIN_PASSWORD || '101190029';

const fastify = Fastify({ logger: true });

// Setup tokenizer
const enc = getEncoding('cl100k_base');
function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return enc.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

// In-Memory Lock untuk mencegah race-condition konkuren
const handled = new Set<string>();

// Setup static files untuk dashboard
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/dashboard/',
});

// Redirect root ke dashboard
fastify.get('/', async (request, reply) => {
  return reply.redirect('/dashboard/login.html');
});

// Helper untuk Base URL API
function getBaseUrl(provider: string): string {
  const p = provider.toLowerCase();
  if (p === 'gemini') return 'https://generativelanguage.googleapis.com';
  if (p === 'anthropic') return 'https://api.anthropic.com';
  if (p === 'cohere') return 'https://api.cohere.ai';
  if (p === 'groq') return 'https://api.groq.com/openai';
  if (p === 'sambanova') return 'https://api.sambanova.ai/v1';
  if (p === 'openrouter') return 'https://openrouter.ai/api/v1';
  return 'https://api.openai.com/v1';
}

// --- SYSM HELPER: LAZY RESET & LAZY RELEASE ---
async function runLazyResetAndRelease() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Lazy Release: Pulihkan model dari karantina jika waktunya sudah lewat
    await client.query(`
      UPDATE models 
      SET status = 'active', quarantine_until = NULL, error_count = 0 
      WHERE status = 'quarantined' AND quarantine_until <= NOW()
    `);

    // 2. Lazy Reset: Menit (RPM/TKM)
    await client.query(`
      UPDATE models 
      SET rpm_used = 0, tkm_used = 0, last_reset_minute = NOW()
      WHERE last_reset_minute IS NULL OR last_reset_minute <= NOW() - INTERVAL '1 minute'
    `);

    // 3. Lazy Reset: Jam (RPH/TKH)
    await client.query(`
      UPDATE models 
      SET rph_used = 0, tkh_used = 0, last_reset_hour = NOW()
      WHERE last_reset_hour IS NULL OR last_reset_hour <= NOW() - INTERVAL '1 hour'
    `);

    // 4. Lazy Reset: Hari (RPD/TKD)
    await client.query(`
      UPDATE models 
      SET rpd_used = 0, tkd_used = 0, last_reset_day = NOW()
      WHERE last_reset_day IS NULL OR last_reset_day <= NOW() - INTERVAL '1 day'
    `);

    // 5. Lazy Reset: Bulan (RPMO/TKMO)
    await client.query(`
      UPDATE models 
      SET rpmo_used = 0, tkmo_used = 0, last_reset_month = NOW()
      WHERE last_reset_month IS NULL OR last_reset_month <= NOW() - INTERVAL '1 month'
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lazy Reset & Release error:', err);
  } finally {
    client.release();
  }
}

// --- SYSM HELPER: DATABASE QUOTA SYNC & SHARING LIMITS UPDATE ---

async function updateModelQuotas(
  model: any, 
  tokensUsed: number, 
  standardizedHeaders: any,
  status: string,
  errorCount: number,
  quarantineUntil: Date | null
) {
  const isRpmShared = model.sharing_limits.includes('rpm');
  const isRphShared = model.sharing_limits.includes('rph');
  const isRpdShared = model.sharing_limits.includes('rpd');
  const isRpmoShared = model.sharing_limits.includes('rpmo');
  const isTkmShared = model.sharing_limits.includes('tkm');
  const isTkhShared = model.sharing_limits.includes('tkh');
  const isTkdShared = model.sharing_limits.includes('tkd');
  const isTkmoShared = model.sharing_limits.includes('tkmo');

  // Fallback pemakaian kuota penambahan manual
  let rpmAdd = 1, rphAdd = 1, rpdAdd = 1, rpmoAdd = 1;
  let tkmAdd = tokensUsed, tkhAdd = tokensUsed, tkdAdd = tokensUsed, tkmoAdd = tokensUsed;

  let rpmSet: number | null = null;
  let rpdSet: number | null = null;
  let tkmSet: number | null = null;
  let tkdSet: number | null = null;

  // Sinkronisasi data kuota sisa riil dari header provider jika terdeteksi
  if (standardizedHeaders) {
    // 1. Sync Rate Limit (RPM / RPD)
    const reqRem = standardizedHeaders.requestsRemaining;
    const reqLimit = standardizedHeaders.requestsLimit || model.rpm || model.rpd || 0;
    if (reqRem !== undefined && reqLimit > 0) {
      const calculatedUsed = Math.max(0, reqLimit - reqRem);
      if (model.rpm > 0) {
        rpmSet = calculatedUsed;
      } else if (model.rpd > 0) {
        rpdSet = calculatedUsed;
      }
    }

    // 2. Sync Token Limit (TKM / TKD)
    const tokRem = standardizedHeaders.tokensRemaining;
    const tokLimit = standardizedHeaders.tokensLimit || model.tkm || model.tkd || 0;
    if (tokRem !== undefined && tokLimit > 0) {
      const calculatedUsed = Math.max(0, tokLimit - tokRem);
      if (model.tkm > 0) {
        tkmSet = calculatedUsed;
      } else if (model.tkd > 0) {
        tkdSet = calculatedUsed;
      }
    }
  }

  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  setClauses.push(`status = $${paramIdx++}`);
  params.push(status);
  setClauses.push(`error_count = $${paramIdx++}`);
  params.push(errorCount);
  setClauses.push(`quarantine_until = $${paramIdx++}`);
  params.push(quarantineUntil);

  // Rate Limits Query Building
  if (rpmSet !== null) {
    setClauses.push(`rpm_used = $${paramIdx++}`);
    params.push(rpmSet);
  } else {
    setClauses.push(`rpm_used = rpm_used + $${paramIdx++}`);
    params.push(rpmAdd);
  }
  setClauses.push(`rph_used = rph_used + $${paramIdx++}`);
  params.push(rphAdd);
  
  if (rpdSet !== null) {
    setClauses.push(`rpd_used = $${paramIdx++}`);
    params.push(rpdSet);
  } else {
    setClauses.push(`rpd_used = rpd_used + $${paramIdx++}`);
    params.push(rpdAdd);
  }
  setClauses.push(`rpmo_used = rpmo_used + $${paramIdx++}`);
  params.push(rpmoAdd);

  // Token Limits Query Building
  if (tkmSet !== null) {
    setClauses.push(`tkm_used = $${paramIdx++}`);
    params.push(tkmSet);
  } else {
    setClauses.push(`tkm_used = tkm_used + $${paramIdx++}`);
    params.push(tkmAdd);
  }
  setClauses.push(`tkh_used = tkh_used + $${paramIdx++}`);
  params.push(tkhAdd);

  if (tkdSet !== null) {
    setClauses.push(`tkd_used = $${paramIdx++}`);
    params.push(tkdSet);
  } else {
    setClauses.push(`tkd_used = tkd_used + $${paramIdx++}`);
    params.push(tkdAdd);
  }
  setClauses.push(`tkmo_used = tkmo_used + $${paramIdx++}`);
  params.push(tkmoAdd);

  const isAnyShared = isRpmShared || isRphShared || isRpdShared || isRpmoShared || isTkmShared || isTkhShared || isTkdShared || isTkmoShared;
  let whereClause = '';
  if (isAnyShared) {
    whereClause = `WHERE api_key_id = $${paramIdx++}`;
    params.push(model.api_key_id);
  } else {
    whereClause = `WHERE id = $${paramIdx++}`;
    params.push(model.id);
  }

  const queryText = `UPDATE models SET ${setClauses.join(', ')} ${whereClause}`;
  await pool.query(queryText, params);
}

async function updateModelFailure(
  model: any,
  status: string,
  errorCount: number,
  quarantineUntil: Date | null,
  consumeRateLimit: boolean
) {
  const isAnyShared = model.sharing_limits.some((m: string) => ['rpm', 'rph', 'rpd', 'rpmo'].includes(m));

  const params = [status, errorCount, quarantineUntil, isAnyShared ? model.api_key_id : model.id];

  const queryText = `
    UPDATE models 
    SET rpm_used = rpm_used + ${consumeRateLimit ? '1' : '0'}, 
        rph_used = rph_used + ${consumeRateLimit ? '1' : '0'}, 
        rpd_used = rpd_used + ${consumeRateLimit ? '1' : '0'}, 
        rpmo_used = rpmo_used + ${consumeRateLimit ? '1' : '0'},
        status = $1, 
        error_count = $2, 
        quarantine_until = $3
    WHERE ${isAnyShared ? 'api_key_id' : 'id'} = $4
  `;
  await pool.query(queryText, params);
}

// --- API ROUTES ---

// 1. POST /api/auth/login
fastify.post('/api/auth/login', async (request, reply) => {
  const { username, password } = request.body as any;
  if (username === adminUser && password === adminPass) {
    return { success: true, token: 'session-token-101190029', username };
  } else {
    reply.status(401);
    return { success: false, message: 'Username atau Password salah!' };
  }
});

// 2. GET /api/api-keys
fastify.get('/api/api-keys', async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT id, name, provider, sharing_limits, created_at FROM api_keys ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal mengambil API Keys.' };
  }
});

// 3. POST /api/api-keys
fastify.post('/api/api-keys', async (request, reply) => {
  const { name, provider, secret_key, sharing_limits } = request.body as any;
  if (!name || !provider || !secret_key) {
    reply.status(400);
    return { error: 'Nama, Provider, dan API Key wajib diisi!' };
  }
  try {
    const encryptedKey = encrypt(secret_key);
    const result = await pool.query(
      'INSERT INTO api_keys (name, provider, secret_key, sharing_limits) VALUES ($1, $2, $3, $4) RETURNING id, name, provider, sharing_limits, created_at',
      [name, provider, encryptedKey, sharing_limits || []]
    );
    return result.rows[0];
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal menyimpan API Key.' };
  }
});

// PUT /api/api-keys/:id
fastify.put('/api/api-keys/:id', async (request, reply) => {
  const { id } = request.params as any;
  const { name, provider, secret_key, sharing_limits } = request.body as any;
  if (!name || !provider) {
    reply.status(400);
    return { error: 'Nama dan Provider wajib diisi!' };
  }
  try {
    let result;
    if (secret_key && secret_key.trim() !== '') {
      const encryptedKey = encrypt(secret_key);
      result = await pool.query(
        'UPDATE api_keys SET name = $1, provider = $2, secret_key = $3, sharing_limits = $4 WHERE id = $5 RETURNING id, name, provider, sharing_limits, created_at',
        [name, provider, encryptedKey, sharing_limits || [], id]
      );
    } else {
      result = await pool.query(
        'UPDATE api_keys SET name = $1, provider = $2, sharing_limits = $3 WHERE id = $4 RETURNING id, name, provider, sharing_limits, created_at',
        [name, provider, sharing_limits || [], id]
      );
    }
    if (result.rows.length === 0) {
      reply.status(404);
      return { error: 'API Key tidak ditemukan.' };
    }
    return result.rows[0];
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal memperbarui API Key.' };
  }
});

// DELETE /api/api-keys/:id
fastify.delete('/api/api-keys/:id', async (request, reply) => {
  const { id } = request.params as any;
  try {
    await pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
    return { success: true, id };
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal menghapus API Key.' };
  }
});

// 4. GET /api/models
fastify.get('/api/models', async (request, reply) => {
  try {
    // Jalankan lazy reset & release sebelum memuat data agar UI selalu terupdate
    await runLazyResetAndRelease();
    
    const result = await pool.query(
      `SELECT m.*, k.name as api_key_name 
       FROM models m 
       JOIN api_keys k ON m.api_key_id = k.id 
       ORDER BY m.created_at DESC`
    );
    return result.rows;
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal mengambil daftar model.' };
  }
});

// 5. POST /api/models
fastify.post('/api/models', async (request, reply) => {
  const body = request.body as any;
  const { api_key_id, model_identifier, model_type, rpm, rph, rpd, rpmo, tkm, tkh, tkd, tkmo } = body;
  if (!api_key_id || !model_identifier || !model_type) {
    reply.status(400);
    return { error: 'API Key ID, Model Identifier, dan Model Type wajib diisi!' };
  }
  try {
    const result = await pool.query(
      `INSERT INTO models (api_key_id, model_identifier, model_type, rpm, rph, rpd, rpmo, tkm, tkh, tkd, tkmo) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [api_key_id, model_identifier, model_type, parseInt(rpm || 0), parseInt(rph || 0), parseInt(rpd || 0), parseInt(rpmo || 0), parseInt(tkm || 0), parseInt(tkh || 0), parseInt(tkd || 0), parseInt(tkmo || 0)]
    );
    return result.rows[0];
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal menyimpan model.' };
  }
});

// PUT /api/models/:id
fastify.put('/api/models/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const { model_identifier, model_type, rpm, rph, rpd, rpmo, tkm, tkh, tkd, tkmo, status, quarantine_until, error_count } = body;
  if (!model_type) {
    reply.status(400);
    return { error: 'Model Type wajib diisi!' };
  }
  try {
    const qUntil = quarantine_until ? new Date(quarantine_until) : null;
    const result = await pool.query(
      `UPDATE models 
       SET model_identifier = $1, model_type = $2, rpm = $3, rph = $4, rpd = $5, rpmo = $6, tkm = $7, tkh = $8, tkd = $9, tkmo = $10, status = $11, quarantine_until = $12, error_count = $13 
       WHERE id = $14 RETURNING *`,
      [model_identifier, model_type, parseInt(rpm || 0), parseInt(rph || 0), parseInt(rpd || 0), parseInt(rpmo || 0), parseInt(tkm || 0), parseInt(tkh || 0), parseInt(tkd || 0), parseInt(tkmo || 0), status || 'active', qUntil, parseInt(error_count || 0), id]
    );
    return result.rows[0];
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal memperbarui model.' };
  }
});

// DELETE /api/models/:id
fastify.delete('/api/models/:id', async (request, reply) => {
  const { id } = request.params as any;
  try {
    await pool.query('DELETE FROM models WHERE id = $1', [id]);
    return { success: true, id };
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal menghapus model.' };
  }
});

// GET /api/scopes
fastify.get('/api/scopes', async (request, reply) => {
  try {
    const result = await pool.query(`
      SELECT s.*, f.scope_name as fallback_scope_name,
             COALESCE(json_agg(json_build_object('model_id', sm.model_id, 'model_identifier', m.model_identifier, 'priority', sm.priority) ORDER BY sm.priority) FILTER (WHERE sm.model_id IS NOT NULL), '[]') as mapped_models
      FROM scopes s
      LEFT JOIN scopes f ON s.fallback_scope_id = f.id
      LEFT JOIN scope_models sm ON s.id = sm.scope_id
      LEFT JOIN models m ON sm.model_id = m.id
      GROUP BY s.id, f.scope_name ORDER BY s.created_at DESC
    `);
    return result.rows;
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal mengambil scopes.' };
  }
});

// POST /api/scopes
fastify.post('/api/scopes', async (request, reply) => {
  const { scope_name, estimated_output_tokens, fallback_scope_id, model_mappings } = request.body as any;
  if (!scope_name) {
    reply.status(400);
    return { error: 'Nama scope wajib diisi!' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scopeRes = await client.query(
      `INSERT INTO scopes (scope_name, estimated_output_tokens, fallback_scope_id) 
       VALUES ($1, $2, $3) ON CONFLICT (scope_name) DO UPDATE SET estimated_output_tokens=EXCLUDED.estimated_output_tokens, fallback_scope_id=EXCLUDED.fallback_scope_id RETURNING id`,
      [scope_name, parseInt(estimated_output_tokens || 400), fallback_scope_id || null]
    );
    const scopeId = scopeRes.rows[0].id;
    await client.query('DELETE FROM scope_models WHERE scope_id = $1', [scopeId]);
    if (model_mappings && Array.isArray(model_mappings)) {
      for (const m of model_mappings) {
        await client.query('INSERT INTO scope_models (scope_id, model_id, priority) VALUES ($1, $2, $3)', [scopeId, m.model_id, parseInt(m.priority)]);
      }
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    reply.status(500);
    return { error: 'Gagal menyimpan scope.' };
  } finally {
    client.release();
  }
});

// PUT /api/scopes/:id
fastify.put('/api/scopes/:id', async (request, reply) => {
  const { id } = request.params as any;
  const { scope_name, estimated_output_tokens, fallback_scope_id, model_mappings } = request.body as any;
  if (!scope_name) {
    reply.status(400);
    return { error: 'Nama scope wajib diisi!' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scopeRes = await client.query(
      `UPDATE scopes 
       SET scope_name = $1, estimated_output_tokens = $2, fallback_scope_id = $3 
       WHERE id = $4 RETURNING id`,
      [scope_name, parseInt(estimated_output_tokens || 400), fallback_scope_id || null, id]
    );
    if (scopeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      reply.status(404);
      return { error: 'Scope tidak ditemukan.' };
    }
    await client.query('DELETE FROM scope_models WHERE scope_id = $1', [id]);
    if (model_mappings && Array.isArray(model_mappings)) {
      for (const m of model_mappings) {
        await client.query('INSERT INTO scope_models (scope_id, model_id, priority) VALUES ($1, $2, $3)', [id, m.model_id, parseInt(m.priority)]);
      }
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    reply.status(500);
    return { error: 'Gagal memperbarui scope.' };
  } finally {
    client.release();
  }
});

// DELETE /api/scopes/:id
fastify.delete('/api/scopes/:id', async (request, reply) => {
  const { id } = request.params as any;
  try {
    await pool.query('DELETE FROM scopes WHERE id = $1', [id]);
    return { success: true, id };
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal menghapus scope.' };
  }
});

// GET /api/logs
fastify.get('/api/logs', async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
    return result.rows;
  } catch (error) {
    reply.status(500);
    return { error: 'Gagal mengambil logs.' };
  }
});

// 9. POST /api/models/test (Cek Model)
fastify.post('/api/models/test', async (request, reply) => {
  const { model_id, format } = request.body as any;
  if (!model_id || !format) {
    reply.status(400);
    return { error: 'Model ID dan format uji wajib diisi!' };
  }
  
  // 1. Tentukan detail model riil
  const modelDb = await pool.query(`
    SELECT m.*, k.provider, k.secret_key, k.sharing_limits 
    FROM models m
    JOIN api_keys k ON m.api_key_id = k.id
    WHERE m.id = $1
  `, [model_id]);
  
  if (modelDb.rows.length === 0) {
    reply.status(404);
    return { error: 'Model tidak ditemukan.' };
  }
  const currentModel = modelDb.rows[0];

  try {
    const decryptedKey = decrypt(currentModel.secret_key);
    console.log(`[DEBUG] Model identifier: ${currentModel.model_identifier}, Provider: ${currentModel.provider}`);
    console.log(`[DEBUG] Decrypted API Key length: ${decryptedKey.length}, prefix: ${decryptedKey.slice(0, 10)}..., suffix: ...${decryptedKey.slice(-10)}`);
    const baseUrl = getBaseUrl(currentModel.provider);
    const config = getProviderConfig(currentModel.provider);
    const modelType = currentModel.model_type || 'text_out';
    const isJsonFormat = format === 'json';

    let url = '';
    let headers = config.headers(decryptedKey);
    let payload: any = {};
    let promptText = '';
    let promptTokens = 0;

    // --- SETUP REQUEST BERDASARKAN MODEL_TYPE ---
    if (modelType === 'embedding') {
      if (currentModel.provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel.model_identifier}:embedContent?key=${decryptedKey}`;
        payload = { content: { parts: [{ text: "Test embedding content" }] } };
        delete headers['Authorization'];
      } else {
        url = `${baseUrl}/v1/embeddings`;
        payload = { input: "Test embedding content", model: currentModel.model_identifier };
      }
      promptTokens = countTokens("Test embedding content");
    } 
    else if (modelType === 'text_to_speech') {
      if (currentModel.provider === 'gemini') {
        url = `${baseUrl}/v1/models/${currentModel.model_identifier}`; // Fallback model info
        payload = {};
      } else {
        url = `${baseUrl}/v1/audio/speech`;
        payload = { model: currentModel.model_identifier, input: "Test speech generation output", voice: "alloy" };
      }
      promptTokens = countTokens("Test speech generation output");
    }
    else if (modelType === 'audio_native_dialog') {
      url = `${baseUrl}/v1/chat/completions`; // Fallback standard chatcompletion
      const unifiedRequest: UnifiedRequest = {
        model: currentModel.model_identifier,
        messages: [{ role: 'user', content: 'Say hello' }],
        temperature: 0.2, max_tokens: 50, stream: false
      };
      payload = config.mapRequest(unifiedRequest, true);
      promptTokens = countTokens("Say hello");
    }
    else if (modelType === 'translator') {
      url = `${baseUrl}/v1/chat/completions`; // Fallback standard chatcompletion
      const unifiedRequest: UnifiedRequest = {
        model: currentModel.model_identifier,
        messages: [{ role: 'user', content: 'Translate: Hello' }],
        temperature: 0.2, max_tokens: 50, stream: false
      };
      payload = config.mapRequest(unifiedRequest, true);
      promptTokens = countTokens("Translate: Hello");
    }
    else {
      // Default: 'text_out'
      url = `${baseUrl}${config.endpoint(currentModel.model_identifier, false)}`;
      promptText = isJsonFormat 
        ? 'Kirimkan data JSON dengan format: { "status": "sukses", "message": "halo" }'
        : 'Jawab halo saja.';
      promptTokens = countTokens(promptText);

      const unifiedRequest: UnifiedRequest = {
        model: currentModel.model_identifier,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.2,
        max_tokens: 250,
        stream: false,
        response_format: format
      };
      payload = config.mapRequest(unifiedRequest, true);
    }

    let rawResult: any = {};
    let response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    let statusCode = response.status;
    let responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      if (key.startsWith('x-ratelimit') || key === 'retry-after' || key === 'content-type' || key === 'date') {
        responseHeaders[key] = val;
      }
    });

    let responseBodyText = '';
    let parsedBody: any = {};

    if (modelType === 'text_to_speech' && response.ok && currentModel.provider !== 'gemini') {
      const buffer = await response.arrayBuffer();
      responseBodyText = `[Audio binary data, length: ${buffer.byteLength} bytes]`;
      parsedBody = { info: 'Audio generated successfully', size_bytes: buffer.byteLength };
      rawResult = parsedBody;
    } else {
      responseBodyText = await response.text();
      try { 
        parsedBody = JSON.parse(responseBodyText); 
        rawResult = parsedBody;
      } catch { 
        parsedBody = { rawText: responseBodyText }; 
        rawResult = parsedBody;
      }
    }

    const formatErrorRegex = /format.*not supported|json_mode.*not supported|cannot respond in.*format|mimetype.*invalid/i;
    const errorMessage = parsedBody.error?.message || parsedBody.error || responseBodyText;
    let retryAttempted = false;

    // Retry hanya berlaku untuk model text_out dalam format JSON
    if (modelType === 'text_out' && format === 'json' && statusCode === 400 && formatErrorRegex.test(errorMessage)) {
      retryAttempted = true;
      const fallbackRequest: UnifiedRequest = {
        model: currentModel.model_identifier,
        messages: [
          { role: 'system', content: 'Jawablah hanya dengan format JSON mentah tanpa markdown block!' },
          { role: 'user', content: promptText }
        ],
        temperature: 0.2, max_tokens: 250, stream: false, response_format: 'text'
      };
      payload = config.mapRequest(fallbackRequest, false);
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      statusCode = response.status;
      responseHeaders = {};
      response.headers.forEach((val, key) => {
        if (key.startsWith('x-ratelimit') || key === 'retry-after' || key === 'content-type' || key === 'date') {
          responseHeaders[key] = val;
        }
      });
      const fallbackBodyText = await response.text();
      try { 
        parsedBody = JSON.parse(fallbackBodyText); 
        rawResult = parsedBody;
      } catch { 
        parsedBody = { rawText: fallbackBodyText }; 
        rawResult = parsedBody;
      }
    }

    let isSuccess = response.ok;
    let outputTokens = 0;
    let responseText = '';
    if (isSuccess) {
      if (modelType === 'embedding') {
        if (currentModel.provider === 'gemini') {
          const vals = parsedBody.embedding?.values || [];
          responseText = `Embedding values generated. Size: ${vals.length}`;
          outputTokens = vals.length;
        } else {
          const vals = parsedBody.data?.[0]?.embedding || [];
          responseText = `Embedding values generated. Size: ${vals.length}`;
          outputTokens = vals.length;
        }
      } 
      else if (modelType === 'text_to_speech') {
        responseText = parsedBody.info || responseBodyText;
        outputTokens = Math.ceil((parsedBody.size_bytes || 0) / 4);
      } 
      else if (modelType === 'audio_native_dialog' || modelType === 'translator') {
        responseText = config.parseResponseText(parsedBody);
        outputTokens = countTokens(responseText);
      } 
      else {
        // text_out
        responseText = config.parseResponseText(parsedBody);
        const providerUsage = config.parseUsage(parsedBody);
        if (providerUsage) {
          promptTokens = providerUsage.promptTokens;
          outputTokens = providerUsage.outputTokens;
        } else {
          outputTokens = countTokens(responseText);
        }
      }
    }

    const totalTokens = promptTokens + outputTokens;
    let finalStatus = currentModel.status;
    let finalErrorCount = currentModel.error_count;
    let finalQuarantineUntil = currentModel.quarantine_until;
    let errorCountIncremented = false;

    const standardizedHeaders = config.parseRateLimitHeaders(responseHeaders);

    if (isSuccess) {
      finalErrorCount = 0;
      finalQuarantineUntil = null;
      finalStatus = 'active';

      await updateModelQuotas(
        currentModel,
        totalTokens,
        standardizedHeaders,
        finalStatus,
        finalErrorCount,
        finalQuarantineUntil
      );
    } else {
      errorCountIncremented = true;
      finalErrorCount = finalErrorCount + 1;
      if (finalErrorCount === 1) {
        finalQuarantineUntil = new Date(Date.now() + 60000);
        finalStatus = 'quarantined';
      } else if (finalErrorCount === 2) {
        finalQuarantineUntil = new Date(Date.now() + 24 * 60 * 60000);
        finalStatus = 'quarantined';
      } else {
        finalQuarantineUntil = null;
        finalStatus = 'inactive';
      }

      const isConnectionError = statusCode === 0 || errorMessage.includes('fetch failed') || errorMessage.includes('timeout') || errorMessage.includes('NetworkError') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED');
      const isRateLimitError = statusCode === 429;
      const consumeRateLimit = !isConnectionError && !isRateLimitError;

      await updateModelFailure(currentModel, finalStatus, finalErrorCount, finalQuarantineUntil, consumeRateLimit);
    }

    await pool.query(
      `INSERT INTO logs (model_id, model_identifier, scope_name, status, prompt_tokens, output_tokens, response_text, error_message, error_count_incremented) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [model_id, currentModel.model_identifier, 'testing', isSuccess ? 'success' : 'failed', promptTokens, outputTokens, isSuccess ? responseText : null, isSuccess ? null : (parsedBody.error?.message || parsedBody.error || responseBodyText), errorCountIncremented]
    );

    const finalModelDb = await pool.query('SELECT * FROM models WHERE id = $1', [model_id]);
    const finalModel = finalModelDb.rows[0];
    const localRemaining = {
      rpm: finalModel.rpm > 0 ? Math.max(0, finalModel.rpm - finalModel.rpm_used) : null,
      rph: finalModel.rph > 0 ? Math.max(0, finalModel.rph - finalModel.rph_used) : null,
      rpd: finalModel.rpd > 0 ? Math.max(0, finalModel.rpd - finalModel.rpd_used) : null,
      rpmo: finalModel.rpmo > 0 ? Math.max(0, finalModel.rpmo - finalModel.rpmo_used) : null,
      tkm: finalModel.tkm > 0 ? Math.max(0, finalModel.tkm - finalModel.tkm_used) : null,
      tkh: finalModel.tkh > 0 ? Math.max(0, finalModel.tkh - finalModel.tkh_used) : null,
      tkd: finalModel.tkd > 0 ? Math.max(0, finalModel.tkd - finalModel.tkd_used) : null,
      tkmo: finalModel.tkmo > 0 ? Math.max(0, finalModel.tkmo - finalModel.tkmo_used) : null,
    };

    if (isSuccess) {
      return { success: true, status: statusCode, retry_attempted: retryAttempted, payload_sent: payload, response_text: responseText, headers: responseHeaders, standardized_headers: standardizedHeaders, local_remaining: localRemaining, raw_response: rawResult };
    } else {
      reply.status(statusCode);
      return { success: false, status: statusCode, retry_attempted: retryAttempted, payload_sent: payload, error_message: parsedBody.error?.message || parsedBody.error || responseBodyText, headers: responseHeaders, standardized_headers: standardizedHeaders, local_remaining: localRemaining, raw_response: rawResult };
    }
  } catch (error: any) {
    reply.status(500);
    return { error: `Gagal memproses pengujian model: ${error.message}` };
  }
});

// =========================================================================
// 10. POST /api/route (MAIN LLM ROUTER & ORCHESTRATOR - SysR & SysM)
// =========================================================================
fastify.post('/api/route', async (request, reply) => {
  const { scope, prompt, response_format, fallback_scope_prompt, stream } = request.body as any;

  if (!scope || !prompt) {
    reply.status(400);
    return { error: 'Scope dan prompt wajib diisi!' };
  }

  // 1. Inisialisasi Dinamis: Jalankan lazy reset & lazy release
  await runLazyResetAndRelease();

  // 2. Tokenisasi input prompt menggunakan js-tiktoken
  const promptTokens = countTokens(prompt);

  // 3. Ambil scope dari DB
  const scopeRes = await pool.query('SELECT * FROM scopes WHERE scope_name = $1', [scope]);
  if (scopeRes.rows.length === 0) {
    reply.status(404);
    return { error: `Scope "${scope}" tidak terdaftar.` };
  }
  const currentScope = scopeRes.rows[0];
  const ETO = currentScope.estimated_output_tokens || 400;

  // 4. Helper filter kapasitas kuota dinamis
  const isModelAvailable = (m: any) => {
    // Abaikan jika sedang dikunci request konkuren lain di memori (pre-filter)
    if (handled.has(m.id)) return false;

    // Metrik RPM / RPH / RPD / RPMO
    if (m.rpm > 0 && m.rpm_used >= m.rpm) return false;
    if (m.rph > 0 && m.rph_used >= m.rph) return false;
    if (m.rpd > 0 && m.rpd_used >= m.rpd) return false;
    if (m.rpmo > 0 && m.rpmo_used >= m.rpmo) return false;

    // Metrik Token (TKM / TKH / TKD / TKMO) dengan safety buffer ETO
    if (m.tkm > 0 && m.tkm_used + promptTokens + ETO > m.tkm) return false;
    if (m.tkh > 0 && m.tkh_used + promptTokens + ETO > m.tkh) return false;
    if (m.tkd > 0 && m.tkd_used + promptTokens + ETO > m.tkd) return false;
    if (m.tkmo > 0 && m.tkmo_used + promptTokens + ETO > m.tkmo) return false;

    return true;
  };

  const modelQuery = `
    SELECT m.*, sm.priority, k.provider, k.secret_key, k.sharing_limits 
    FROM scope_models sm
    JOIN models m ON sm.model_id = m.id
    JOIN api_keys k ON m.api_key_id = k.id
    WHERE sm.scope_id = $1 AND m.status = 'active'
    ORDER BY sm.priority ASC
  `;
  
  const primaryModelsRes = await pool.query(modelQuery, [currentScope.id]);
  let candidateModels = primaryModelsRes.rows;
  let filteredModels = candidateModels.filter(isModelAvailable);

  // --- FIX: ROTASI FALLBACK SCOPE LOGIC ---
  // Jika model utama kosong ATAU semuanya sedang kehabisan limit (filteredModels.length === 0), coba fallback scope
  if (filteredModels.length === 0 && currentScope.fallback_scope_id) {
    fastify.log.info(`All primary models in scope "${scope}" are exhausted. Checking fallback scope...`);
    const fallbackModelsRes = await pool.query(modelQuery, [currentScope.fallback_scope_id]);
    candidateModels = fallbackModelsRes.rows;
    filteredModels = candidateModels.filter(isModelAvailable);
  }

  if (filteredModels.length === 0) {
    reply.status(503);
    return { error: 'Semua kapasitas model telah penuh (rate limit terlampaui) pada scope utama dan fallback.' };
  }

  // 6. Eksekusi Model sesuai urutan Prioritas
  for (const model of filteredModels) {
    // --- FIX: ATOMIC LOCK RE-CHECK (Mengatasi Race Condition / Concurrency Bypass) ---
    // Di lingkungan highly-concurrent, bisa jadi request lain baru saja mengunci model ini setelah fungsi filter() selesai.
    if (handled.has(model.id)) {
      continue; // Lewati, coba model prioritas berikutnya di dalam loop
    }

    // Dapatkan semua ID model saudara di bawah API key yang sama jika sharing limits aktif
    const isAnyShared = model.sharing_limits.length > 0;
    let lockedIds: string[] = [model.id];
    
    if (isAnyShared) {
      const siblingRes = await pool.query('SELECT id FROM models WHERE api_key_id = $1', [model.api_key_id]);
      lockedIds = siblingRes.rows.map((r: any) => r.id);
    }

    // --- FINAL ATOMIC LOCK RE-CHECK (Khusus Siblings) ---
    if (lockedIds.some(id => handled.has(id))) {
      continue; // Lewati model ini karena saudaranya sudah dikunci oleh request konkuren lain
    }

    // Kunci model (dan saudaranya jika sharing limits aktif) di memori secara atomik
    lockedIds.forEach(id => handled.add(id));

    // Pasang safety timeout untuk membebaskan lock jika crash/disconnection internal sistem
    const safetyTimeout = setTimeout(() => {
      lockedIds.forEach(id => handled.delete(id));
    }, 60000);

    try {
      const decryptedKey = decrypt(model.secret_key);
      const baseUrl = getBaseUrl(model.provider);
      const config = getProviderConfig(model.provider);
      const isStream = stream === true || stream === 'true';

      const url = `${baseUrl}${config.endpoint(model.model_identifier, isStream)}`;
      const headers = config.headers(decryptedKey);

      // Gunakan fallback_scope_prompt jika menggunakan fallback scope
      const promptToUse = (model.scope_id !== currentScope.id && fallback_scope_prompt) 
        ? fallback_scope_prompt 
        : prompt;

      let messages: UnifiedMessage[] = [{ role: 'user' as const, content: promptToUse }];

      const unifiedRequest: UnifiedRequest = {
        model: model.model_identifier,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: isStream,
        response_format: response_format || 'text'
      };

      let payload = config.mapRequest(unifiedRequest, true);

      // --- FIX: ABORT CONTROLLER (Mencegah Stream Leak / Zero Waste Violation) ---
      const abortController = new AbortController();
      const onClientClose = () => {
        fastify.log.info(`Client disconnected. Aborting fetch to model ${model.model_identifier} to save quota.`);
        abortController.abort();
      };
      
      // Dengarkan jika client menutup koneksi
      request.raw.on('close', onClientClose);

      console.log(`Routing request to model: ${model.model_identifier} on ${url}...`);

      let response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: abortController.signal
      });
      request.raw.off('close', onClientClose);

      // --- LOGIKA RETRY JIKA FORMAT TIDAK DIDUKUNG ---
      const formatErrorRegex = /format.*not supported|json_mode.*not supported|cannot respond in.*format|mimetype.*invalid/i;
      
      if (response_format === 'json' && response.status === 400) {
        const errText = await response.clone().text();
        if (formatErrorRegex.test(errText)) {
          console.log(`Fallback retry triggered for ${model.model_identifier} due to format error.`);
          const fallbackRequest: UnifiedRequest = {
            model: model.model_identifier,
            messages: [
              { role: 'system', content: currentScope.system_prompt ? `${currentScope.system_prompt}\nJawablah hanya dalam format JSON mentah!` : 'Jawablah hanya dalam format JSON mentah tanpa markdown block!' },
              { role: 'user', content: promptToUse }
            ],
            temperature: 0.7, max_tokens: 1000, stream: isStream, response_format: 'text'
          };
          payload = config.mapRequest(fallbackRequest, false);
          
          request.raw.on('close', onClientClose);
          response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: abortController.signal
          });
          request.raw.off('close', onClientClose);
        }
      }

      if (!response.ok) {
        throw new Error(`Provider returned HTTP ${response.status}: ${await response.text()}`);
      }

      // --- 7A. LOGIKA STREAMING (Server-Sent Events) ---
      if (isStream) {
        clearTimeout(safetyTimeout);
        
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Content-Encoding': 'none'
        });

        let accumulatedText = '';
        const reader = response.body;

        if (reader) {
          // Re-attach close listener during SSE streaming phase
          request.raw.on('close', onClientClose);
          try {
            let buffer = '';
            for await (const chunk of reader as any) {
              const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString() : new TextDecoder().decode(chunk);
              
              if (model.provider === 'gemini') {
                const match = chunkStr.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (match) {
                  try { 
                    const textDelta = JSON.parse(`"${match[1]}"`);
                    accumulatedText += textDelta;
                    reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: textDelta } }] })}\n\n`);
                  } catch {}
                }
              } else {
                buffer += chunkStr;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Simpan chunk tidak lengkap ke iterasi berikutnya
                
                for (const line of lines) {
                  let textDelta = '';
                  if (model.provider === 'anthropic') {
                    if (line.startsWith('data: ')) {
                      try {
                        const parsed = JSON.parse(line.slice(6));
                        if (parsed.type === 'content_block_delta') {
                          textDelta = parsed.delta?.text || '';
                        }
                      } catch {}
                    }
                  } else {
                    if (line.startsWith('data: ')) {
                      const dataStr = line.slice(6).trim();
                      if (dataStr && dataStr !== '[DONE]') {
                        try {
                          const parsed = JSON.parse(dataStr);
                          textDelta = parsed.choices?.[0]?.delta?.content || '';
                        } catch {}
                      }
                    }
                  }

                  if (textDelta) {
                    accumulatedText += textDelta;
                    reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: textDelta } }] })}\n\n`);
                  }
                }
              }
            }
          } catch (streamErr: any) {
            if (streamErr.name === 'AbortError') {
              console.log(`Stream properly aborted for ${model.model_identifier} to save free tier quotas.`);
            } else {
              throw streamErr;
            }
          } finally {
            request.raw.off('close', onClientClose);
          }
        }

        if (!abortController.signal.aborted) {
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        } else {
          reply.raw.end(); // Jangan paksa tulis DONE jika stream di-abort klien
        }

        // Asinkronus Post-Update
        const finalOutputTokens = countTokens(accumulatedText);
        const finalTotalTokens = promptTokens + finalOutputTokens;

        // Update DB menggunakan helper terpadu (sharing limits diselaraskan secara dinamis)
        await updateModelQuotas(
          model,
          finalTotalTokens,
          null, // SSE Stream tidak mengandung header di body akhir, gunakan manual fallback
          'active',
          0,
          null
        );

        await pool.query(
          `INSERT INTO logs (model_id, model_identifier, scope_name, status, prompt_tokens, output_tokens, response_text) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [model.id, model.model_identifier, scope, 'success', promptTokens, finalOutputTokens, accumulatedText]
        );

        lockedIds.forEach(id => handled.delete(id));
        return; // Selesai
      }

      // --- 7B. LOGIKA NON-STREAMING (JSON Response) ---
      const responseTextRaw = await response.text();
      let responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        if (key.startsWith('x-ratelimit') || key === 'retry-after' || key === 'content-type' || key === 'date') {
          responseHeaders[key] = val;
        }
      });

      let parsedBody: any = {};
      try { parsedBody = JSON.parse(responseTextRaw); } catch { parsedBody = { rawText: responseTextRaw }; }

      const responseText = config.parseResponseText(parsedBody);
      let finalPromptTokens = promptTokens;
      let finalOutputTokens = countTokens(responseText);

      const usage = config.parseUsage(parsedBody);
      if (usage) {
        finalPromptTokens = usage.promptTokens;
        finalOutputTokens = usage.outputTokens;
      }

      const totalTokens = finalPromptTokens + finalOutputTokens;

      // Sinkronisasi limits dari headers provider
      const standardizedHeaders = config.parseRateLimitHeaders(responseHeaders);

      // Update DB menggunakan helper terpadu (sharing limits diselaraskan secara dinamis)
      await updateModelQuotas(
        model,
        totalTokens,
        standardizedHeaders,
        'active',
        0,
        null
      );

      // Catat log sukses
      await pool.query(
        `INSERT INTO logs (model_id, model_identifier, scope_name, status, prompt_tokens, output_tokens, response_text) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [model.id, model.model_identifier, scope, 'success', finalPromptTokens, finalOutputTokens, responseText]
      );

      clearTimeout(safetyTimeout);
      lockedIds.forEach(id => handled.delete(id));

      // Kembalikan Unified JSON Response OpenAI-compatible ke client
      return {
        id: `chatcmpl-${model.id}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model.model_identifier,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: responseText },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: finalPromptTokens,
          completion_tokens: finalOutputTokens,
          total_tokens: totalTokens
        }
      };

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Abaikan dan bebaskan memori, jangan catat ini sebagai kegagalan API karena ini di-abort klien secara damai
        clearTimeout(safetyTimeout);
        lockedIds.forEach(id => handled.delete(id));
        return; 
      }

      clearTimeout(safetyTimeout);
      lockedIds.forEach(id => handled.delete(id));
      fastify.log.error(`Model ${model.model_identifier} failed: ${err.message}`);

      // Eskalasi error di database
      let finalErrorCount = model.error_count + 1;
      let finalStatus = 'active';
      let finalQuarantineUntil = null;

      if (finalErrorCount === 1) {
        finalQuarantineUntil = new Date(Date.now() + 60000);
        finalStatus = 'quarantined';
      } else if (finalErrorCount === 2) {
        finalQuarantineUntil = new Date(Date.now() + 24 * 60 * 60000);
        finalStatus = 'quarantined';
      } else {
        finalStatus = 'inactive';
      }

      // Deteksi penyebab kegagalan:
      // 1. Connection error / cannot be reached: err.message mengandung 'fetch failed' atau network/timeout
      // 2. 429 Too Many Requests: err.message mengandung 'HTTP 429' atau '429'
      const isConnectionError = err.message.includes('fetch failed') || err.message.includes('timeout') || err.message.includes('NetworkError') || err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED');
      const isRateLimitError = err.message.includes('429') || err.message.includes('status 429');
      const consumeRateLimit = !isConnectionError && !isRateLimitError;

      // Update DB menggunakan helper terpadu (sharing limits diselaraskan secara dinamis)
      await updateModelFailure(model, finalStatus, finalErrorCount, finalQuarantineUntil, consumeRateLimit);

      // Catat log gagal
      await pool.query(
        `INSERT INTO logs (model_id, model_identifier, scope_name, status, prompt_tokens, output_tokens, error_message, error_count_incremented) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [model.id, model.model_identifier, scope, 'failed', promptTokens, 0, err.message, true]
      );
    }
  }

  reply.status(503);
  return { error: 'Seluruh kandidat model aktif pada scope ini mengalami kegagalan eksekusi.' };
});

// --- SERVER STARTUP ---
if (!process.env.VERCEL) {
  const start = async () => {
    try {
      await initializeDatabaseWithRetry();
      await fastify.listen({ port, host: '0.0.0.0' });
      console.log(`Server berjalan di http://localhost:${port}`);
      console.log(`Buka halaman dashboard di http://localhost:${port}/dashboard/login.html`);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };
  start();
}

// Export handler untuk Vercel Serverless
export default async function handler(req: any, res: any) {
  await initializeDatabaseWithRetry();
  await fastify.ready();
  fastify.server.emit('request', req, res);
}
