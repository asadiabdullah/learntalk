const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const res = await client.query(`
      SELECT m.id, m.model_identifier, m.status, k.name as key_name, k.provider 
      FROM models m
      JOIN api_keys k ON m.api_key_id = k.id
    `);
    
    console.log('\n--- Registered Models & Keys Mapping ---');
    res.rows.forEach(row => {
      console.log(`Model: "${row.model_identifier}" (ID: ${row.id})`);
      console.log(`- Linked to API Key: "${row.key_name}" (Provider: ${row.provider})`);
      console.log(`- Status: ${row.status}`);
      console.log('---');
    });
    
  } catch (err) {
    console.error('Error fetching models:', err);
  } finally {
    await client.end();
  }
}

run();
