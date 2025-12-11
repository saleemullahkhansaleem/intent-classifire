// src/db/database.js
// PostgreSQL-only database connection and initialization
// Supports: Vercel Postgres, Neon, Supabase, or any standard PostgreSQL

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

let postgresPool = null;

/**
 * Initialize and return PostgreSQL client pool
 */
async function getPostgresClient() {
  if (postgresPool) {
    return postgresPool;
  }

  // Get connection string from environment (try multiple variable names for compatibility)
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.VERCEL_POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "No PostgreSQL connection string found. Set POSTGRES_URL, DATABASE_URL, or VERCEL_POSTGRES_URL environment variable."
    );
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("[Database] Unexpected error on idle PostgreSQL client:", err);
  });

  postgresPool = pool;
  return postgresPool;
}

/**
 * Get database connection object with query/execute methods
 */
export function getDb() {
  return {
    query: async (queryText, params = []) => {
      try {
        const client = await getPostgresClient();
        const result = await client.query(queryText, params);
        return {
          rows: result.rows || [],
          rowCount: result.rowCount || 0,
        };
      } catch (error) {
        console.error("[Database] Query error:", error.message);
        throw error;
      }
    },

    execute: async (queryText, params = []) => {
      try {
        const client = await getPostgresClient();
        await client.query(queryText, params);
      } catch (error) {
        console.error("[Database] Execute error:", error.message);
        throw error;
      }
    },
  };
}

/**
 * Initialize database schema
 */
export async function initDatabase() {
  const db = getDb();

  // Categories table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      threshold REAL DEFAULT 0.4,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Examples table with embedding column
  await db.execute(`
    CREATE TABLE IF NOT EXISTS examples (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      embedding TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table for global configuration
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL UNIQUE PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for performance
  try {
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_examples_category_id ON examples(category_id)"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_examples_text ON examples(text)"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)"
    );
  } catch (error) {
    // Indexes might already exist - that's fine
    if (!error.message.includes("already exists")) {
      console.warn("[Database] Index creation note:", error.message);
    }
  }

  console.log("[Database] Schema initialized successfully");
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (postgresPool) {
    await postgresPool.end();
    postgresPool = null;
    console.log("[Database] Connection closed");
  }
}
