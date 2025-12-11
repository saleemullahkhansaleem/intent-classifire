-- Database schema for intent classifier
-- PostgreSQL only (no SQLite support)

-- Categories table (renamed from labels)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  threshold REAL DEFAULT 0.4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Examples table
CREATE TABLE IF NOT EXISTS examples (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding TEXT, -- JSON string of embedding vector
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table for global configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL UNIQUE PRIMARY KEY,
  value TEXT NOT NULL, -- JSON string
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_examples_category_id ON examples(category_id);
CREATE INDEX IF NOT EXISTS idx_examples_text ON examples(text);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
