import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set in env");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for secure Supabase connections
  }
});

async function main() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL database successfully!");

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  console.log("Executing table creation query...");
  await client.query(createTableQuery);
  console.log("Table 'users' created successfully or already exists!");

  // Verify the schema by selecting columns
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users';
  `);
  console.log("Schema of 'users' table:");
  console.log(res.rows);

  await client.end();
}

main().catch(err => {
  console.error("Database setup failed:", err);
  process.exit(1);
});
