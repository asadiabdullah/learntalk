const crypto = require('crypto');

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

// Decrypted key from database analysis
const dbCipherText = '0d32152865cc3ab0c5a61111:51ba9765275e63be7173b9e4a3b194d4:e465d6bd88...'; // we will fetch it from database dynamically

const { Client } = require('pg');
const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT secret_key FROM api_keys WHERE provider = 'groq' LIMIT 1");
    if (res.rows.length === 0) {
      console.log('No Groq key found in DB');
      return;
    }
    
    const decryptedKey = decrypt(res.rows[0].secret_key);
    console.log('Testing decrypted Groq key directly against Groq API...');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10
      })
    });
    
    const status = response.status;
    const bodyText = await response.text();
    console.log(`HTTP Status: ${status}`);
    console.log(`Response Body: ${bodyText}`);
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await client.end();
  }
}

run();
