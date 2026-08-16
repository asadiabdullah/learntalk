const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const RAW_KEY = process.env.DATABASE_ENCRYPTION_KEY || 'abcdefghijklmnopqrstuvwxyz123456';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
const ALGORITHM = 'aes-256-gcm';

function decrypt(cipherText) {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid cipher text format. Expected iv:authTag:encrypted');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase database.');
    console.log(`Using encryption key source: ${process.env.DATABASE_ENCRYPTION_KEY ? 'process.env.DATABASE_ENCRYPTION_KEY' : 'default fallback key'}`);
    
    const res = await client.query('SELECT id, name, provider, secret_key FROM api_keys');
    
    console.log('\n--- Decryption Analysis ---');
    for (const row of res.rows) {
      try {
        const decrypted = decrypt(row.secret_key);
        const trimmed = decrypted.trim();
        
        console.log(`\nProvider Name: "${row.name}" (${row.provider})`);
        console.log(`- Decrypted successfully!`);
        console.log(`- Total length: ${decrypted.length} characters`);
        console.log(`- Prefix: "${decrypted.slice(0, 8)}..."`);
        console.log(`- Suffix: "...${decrypted.slice(-8)}"`);
        
        if (decrypted.length !== trimmed.length) {
          console.log(`- WARNING: Key has leading/trailing whitespaces or newlines (diff: ${decrypted.length - trimmed.length} chars)`);
        }
      } catch (err) {
        console.log(`\nProvider Name: "${row.name}" (${row.provider})`);
        console.error(`- DECRYPTION FAILED! Error: ${err.message}`);
        console.error(`  Make sure your DATABASE_ENCRYPTION_KEY matches the one used when inserting this key!`);
      }
    }
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await client.end();
  }
}

run();
