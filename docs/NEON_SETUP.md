# Neon Database Setup Guide

## ✅ What You've Done

1. ✅ Set up Neon database on Vercel
2. ✅ Added `pg` package to dependencies
3. ✅ Updated database connection code to support Neon
4. ✅ Added `POSTGRES_URL` to `.env.local`

## 🚀 Next Steps

### 1. Initialize Database Schema

Run this command to create all necessary tables:

```bash
node -e "import('./src/db/database.js').then(m => m.initDatabase().then(() => console.log('✅ Database initialized!')))"
```

Or use the migration script:

```bash
node src/db/migrate.js
```

### 2. Migrate Data from JSON

Import your existing categories and examples:

```bash
node src/db/migrate.js --migrate-json
```

This will:

- Import all categories from `data/labels.json`
- Import all examples for each category
- Set default threshold to 0.4 for all categories

### 3. Test the Connection

Test that everything works:

```bash
# Start your dev server
npm run dev
```

Then:

- Go to http://localhost:3000
- Navigate to "Manage" tab
- You should see all your categories from the database!

## 📝 Environment Variables

Your `.env.local` should have:

```env
POSTGRES_URL=postgresql://neondb_owner:...@ep-crimson-fog-ahrzq1q3-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
OPENAI_API_KEY=your-openai-api-key
```

**Note**: When you deploy to Vercel, these environment variables will be automatically set by Neon integration.

## 🔍 Verify Database Connection

To check if the connection works:

```bash
node -e "
import('./src/db/database.js').then(async (db) => {
  await db.initDatabase();
  const dbConn = db.getDb();
  const result = await dbConn.query('SELECT COUNT(*) as count FROM categories');
  console.log('Categories in database:', result.rows[0].count);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
"
```

## 🎯 Deployment Checklist

Before deploying to Vercel:

- [x] Neon database set up on Vercel
- [x] `pg` package added to `package.json`
- [x] Database connection code updated
- [ ] Database initialized locally (test)
- [ ] Data migrated from JSON (test)
- [ ] Tested locally with Neon database

## 🚨 Troubleshooting

### Connection Issues

If you get connection errors:

1. **Check POSTGRES_URL format**: Should be `postgresql://user:pass@host/dbname?sslmode=require`
2. **SSL required**: Neon requires SSL, make sure `sslmode=require` is in the URL
3. **Pooler URL**: Use the pooler URL (`-pooler.`) for better connection handling

### Migration Issues

If migration fails:

1. Check if tables already exist: The migration script will skip if data exists
2. Use `--force` flag to clear and re-migrate:
   ```bash
   node src/db/migrate.js --migrate-json --force
   ```

## 📊 What Gets Migrated

From `data/labels.json`:

- ✅ All categories (with descriptions)
- ✅ All examples for each category
- ✅ Default threshold of 0.4 for each category

After migration, your database will have:

- `categories` table with all your categories
- `examples` table with all training examples
- Ready for embedding recomputation!

## 🎉 You're All Set!

Once you've:

1. Initialized the database schema
2. Migrated your data
3. Tested locally

You're ready to deploy to Vercel! The database connection will automatically work in production since Neon integration sets `POSTGRES_URL` automatically.
