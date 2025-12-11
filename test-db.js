import "dotenv/config";
import { initDatabase, getDb } from "./src/db/database.js";

async function testDb() {
  try {
    console.log("Connecting to database...");
    await initDatabase();
    const db = getDb();
    
    console.log("\n[1] Check categories:");
    const categories = await db.query("SELECT id, name FROM categories");
    console.log("Categories:", categories.rows || categories);
    
    console.log("\n[2] Check examples with embeddings:");
    const examples = await db.query(`
      SELECT 
        e.id,
        e.category_id, 
        c.name,
        e.text,
        CASE WHEN e.embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_embedding
      FROM examples e
      JOIN categories c ON e.category_id = c.id
      LIMIT 10
    `);
    console.log("Examples:", examples.rows || examples);
    
    console.log("\n[3] Count examples with embeddings:");
    const count = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding
      FROM examples
    `);
    console.log("Count:", count.rows || count);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testDb();
