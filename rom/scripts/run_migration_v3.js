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
    
    const sqlPath = path.join(__dirname, 'add_model_type.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('ROM migration v3 (model_type column) executed successfully!');
    
  } catch (err) {
    console.error('Error executing migration v3:', err);
  } finally {
    await client.end();
  }
}

run();
