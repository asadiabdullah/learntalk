const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zdaylammqonjurfqalbt:%40%25Abdullah55rom@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_profiles', 'messages', 'message_embeddings', 'glossary');
    `;
    
    const res = await client.query(query);
    console.log('Existing public tables:');
    res.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (err) {
    console.error('Error verifying tables:', err);
  } finally {
    await client.end();
  }
}

run();
