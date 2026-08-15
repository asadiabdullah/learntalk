import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in environment variables.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  idleTimeoutMillis: 10000, // 10 seconds idle timeout to prevent connection leak on free tier
  ssl: { rejectUnauthorized: false }
});

// Boot Retry logic to wake up Supabase/Neon sleep mode database
export async function initializeDatabaseWithRetry(retries = 3, delay = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`Database connection attempt ${i} of ${retries}...`);
      const client = await pool.connect();
      console.log('Database connection established successfully!');
      client.release();
      return;
    } catch (error) {
      console.error(`Database connection attempt ${i} failed.`, error);
      if (i < retries) {
        console.log(`Waiting ${delay / 1000} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error('Could not connect to database after maximum retries. Process exiting.');
      }
    }
  }
}
