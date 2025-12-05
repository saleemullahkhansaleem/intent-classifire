// src/db/database.js
// Database connection utility supporting both SQLite (local) and Vercel Postgres (production)

import "dotenv/config";
import Database from "better-sqlite3";
import { sql } from "@vercel/postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.VERCEL === "1" || process.env.POSTGRES_URL;
const DB_PATH = path.resolve(__dirname, "../../data/database.db");

let sqliteDb = null;

/**
 * Get database connection - SQLite for local, Vercel Postgres for production
 */
export function getDb() {
  if (isProduction) {
    // Use Vercel Postgres in production
    return {
      query: async (queryText, params = []) => {
        try {
          const result = await sql.query(queryText, params);
          return result;
        } catch (error) {
          console.error("Database query error:", error);
          throw error;
        }
      },
      execute: async (queryText, params = []) => {
        try {
          await sql.query(queryText, params);
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
  const isPostgres = isProduction;

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
 * Close database connection (for SQLite)
 */
export function closeDatabase() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
