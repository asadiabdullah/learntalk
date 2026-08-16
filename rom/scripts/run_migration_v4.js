const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    const sqlPath = path.join(__dirname, 'remove_system_prompt.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('ROM migration v4 (remove system_prompt column) executed successfully!');
    
  } catch (err) {
    console.error('Error executing migration v4:', err);
  } finally {
    await client.end();
  }
}

run();
