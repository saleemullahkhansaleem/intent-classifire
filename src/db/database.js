// src/db/database.js
// Database connection utility supporting both SQLite (local) and PostgreSQL (production)

import "dotenv/config";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.VERCEL === "1";
const usePostgres =
  process.env.VERCEL === "1" ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;
const DB_PATH = path.resolve(__dirname, "../../data/database.db");

let sqliteDb = null;
let postgresPool = null;

/**
 * Initialize PostgreSQL client (supports both Vercel Postgres and standard PostgreSQL like Neon)
 */
async function getPostgresClient() {
  if (postgresPool) {
    return postgresPool;
  }

  // Check if we have POSTGRES_URL (Neon, Supabase, or other standard PostgreSQL)
  if (process.env.POSTGRES_URL) {
    const pg = await import("pg");
    const { Pool } = pg.default || pg;

    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.POSTGRES_URL.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });

    postgresPool = {
      query: async (queryText, params = []) => {
        const result = await pool.query(queryText, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      },
      end: async () => {
        await pool.end();
        postgresPool = null;
      },
    };
    return postgresPool;
  }

  // Fallback to Vercel Postgres (if @vercel/postgres is available and no POSTGRES_URL)
  try {
    const { sql } = await import("@vercel/postgres");
    postgresPool = {
      query: async (queryText, params = []) => {
        return await sql.query(queryText, params);
      },
    };
    return postgresPool;
  } catch (error) {
    // @vercel/postgres not available
    throw new Error(
      "No PostgreSQL connection available. Set POSTGRES_URL environment variable."
    );
  }
}

/**
 * Get database connection - SQLite for local, PostgreSQL for production
 */
export function getDb() {
  if (usePostgres) {
    // Use PostgreSQL (either in production or locally if POSTGRES_URL is set)
    return {
      query: async (queryText, params = []) => {
        try {
          const client = await getPostgresClient();
          const result = await client.query(queryText, params);
          // Ensure result has rows property
          return {
            rows: result.rows || result,
            rowCount:
              result.rowCount ||
              (Array.isArray(result.rows) ? result.rows.length : 0),
          };
        } catch (error) {
          console.error("Database query error:", error);
          throw error;
        }
      },
      execute: async (queryText, params = []) => {
        try {
          const client = await getPostgresClient();
          await client.query(queryText, params);
        } catch (error) {
          console.error("Database execute error:", error);
          throw error;
        }
      },
    };
  } else {
    // Use SQLite for local development

    if (!sqliteDb) {
      // Ensure data directory exists
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      sqliteDb = new Database(DB_PATH);
      sqliteDb.pragma("journal_mode = WAL");
    }
    return {
      query: (queryText, params = []) => {
        try {
          // Convert Postgres-style placeholders ($1, $2) to SQLite (?)
          let sqliteQuery = queryText;
          const sqliteParams = [];

          // Handle parameterized queries
          let paramIndex = 1;
          sqliteQuery = queryText.replace(/\$(\d+)/g, (match, num) => {
            const index = parseInt(num) - 1;
            if (params[index] !== undefined) {
              sqliteParams.push(params[index]);
              return "?";
            }
            return match;
          });

          const stmt = sqliteDb.prepare(sqliteQuery);
          const result = stmt.all(...sqliteParams);

          // Return in similar format to Postgres
          return {
            rows: result,
            rowCount: result.length,
          };
        } catch (error) {
          console.error("SQLite query error:", error);
          throw error;
        }
      },
      execute: (queryText, params = []) => {
        try {
          let sqliteQuery = queryText;
          const sqliteParams = [];

          let paramIndex = 1;
          sqliteQuery = queryText.replace(/\$(\d+)/g, (match, num) => {
            const index = parseInt(num) - 1;
            if (params[index] !== undefined) {
              sqliteParams.push(params[index]);
              return "?";
            }
            return match;
          });

          const stmt = sqliteDb.prepare(sqliteQuery);
          stmt.run(...sqliteParams);
        } catch (error) {
          console.error("SQLite execute error:", error);
          throw error;
        }
      },
    };
  }
}

/**
 * Initialize database schema
 */
export async function initDatabase() {
  const db = getDb();

  // Create tables based on database type
  const isPostgres = usePostgres;

  // Categories table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id ${
        isPostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT"
      },
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      threshold REAL DEFAULT 0.4,
      created_at ${
        isPostgres ? "TIMESTAMP" : "DATETIME"
      } DEFAULT CURRENT_TIMESTAMP,
      updated_at ${
        isPostgres ? "TIMESTAMP" : "DATETIME"
      } DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Examples table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS examples (
      id ${
        isPostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT"
      },
      category_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT,
      created_at ${
        isPostgres ? "TIMESTAMP" : "DATETIME"
      } DEFAULT CURRENT_TIMESTAMP,
      updated_at ${
        isPostgres ? "TIMESTAMP" : "DATETIME"
      } DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `);

  // Embeddings cache table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS embeddings_cache (
      id ${
        isPostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT"
      },
      text_hash TEXT NOT NULL UNIQUE,
      embedding TEXT NOT NULL,
      model_name TEXT NOT NULL,
      created_at ${
        isPostgres ? "TIMESTAMP" : "DATETIME"
      } DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL UNIQUE PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at ${
        isPostgres ? "TIMESTAMP" : "DATETIME"
      } DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  try {
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_examples_category_id ON examples(category_id)"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_examples_text ON examples(text)"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_embeddings_cache_hash ON embeddings_cache(text_hash)"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)"
    );
  } catch (error) {
    // Indexes might already exist, ignore errors
    console.log("Index creation note:", error.message);
  }
}

/**
 * Close database connection (for SQLite and PostgreSQL)
 */
export async function closeDatabase() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  if (postgresPool && postgresPool.end) {
    await postgresPool.end();
    postgresPool = null;
  }
}
