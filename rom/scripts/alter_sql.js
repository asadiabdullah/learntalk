const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    await client.query('ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;');
    console.log('Column is_pinned added successfully!');
    
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
