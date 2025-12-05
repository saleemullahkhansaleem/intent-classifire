-- Database schema for intent classifier
-- Supports both SQLite and PostgreSQL

-- Categories table (renamed from labels)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  threshold REAL DEFAULT 0.4,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Examples table
CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding TEXT, -- JSON string of embedding vector
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Embeddings cache table
CREATE TABLE IF NOT EXISTS embeddings_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_hash TEXT NOT NULL UNIQUE,
  embedding TEXT NOT NULL, -- JSON string of embedding vector
  model_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table for global configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL UNIQUE PRIMARY KEY,
  value TEXT NOT NULL, -- JSON string
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_examples_category_id ON examples(category_id);
CREATE INDEX IF NOT EXISTS idx_examples_text ON examples(text);
CREATE INDEX IF NOT EXISTS idx_embeddings_cache_hash ON embeddings_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
