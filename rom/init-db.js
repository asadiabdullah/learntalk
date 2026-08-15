const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not defined in .env file.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Neon in some environments
  });

  try {
    await client.connect();
    console.log('Connected successfully. Reading schema.sql...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema.sql...');
    await client.query(schemaSql);
    
    console.log('Database schema initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await client.end();
  }
}

initDb();
