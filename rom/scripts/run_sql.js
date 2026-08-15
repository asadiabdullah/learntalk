const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    const sql = fs.readFileSync('setup_database.sql', 'utf8');
    
    await client.query(sql);
    console.log('SQL script executed successfully!');
    
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
