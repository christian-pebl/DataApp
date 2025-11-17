# Fix: Areas Color Column Missing Error

**Error:** `Could not find the 'color' column of 'areas' in the schema cache`
**When:** Drawing map areas
**Cause:** Database schema missing visual property columns

---

## 🔍 Problem

The `areas` table in your Supabase database is missing these columns:
- `color` (TEXT)
- `size` (INTEGER)
- `transparency` (INTEGER)

The code is trying to insert these values, but the database doesn't have these columns yet.

---

## ✅ Quick Fix

### Option 1: Run the Migration Script (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste this SQL:

```sql
-- Add missing visual properties to areas table
ALTER TABLE areas
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS transparency INTEGER DEFAULT 20;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'areas'
AND column_name IN ('color', 'size', 'transparency');
```

5. Click **Run** or press `Ctrl+Enter`
6. Verify you see 3 rows returned (color, size, transparency)

---

### Option 2: Run Existing Migration File

The fix already exists in your repo! Just run this SQL file in Supabase:

**File:** `supabase/migrations/002_add_visual_properties.sql`

OR

**File:** `fix_missing_columns.sql`

---

## 🧪 Test the Fix

After running the SQL:

1. Refresh your app (Ctrl+R)
2. Try drawing an area on the map
3. The error should be gone!

---

## 📝 What Happened

**Timeline:**
1. ✅ Code was updated to support area colors/sizes
2. ✅ Migration SQL files were created
3. ❌ Migration SQL was **never run** on the database
4. ❌ Database schema is out of sync with code

**Why it happens:**
- Migrations need to be manually run in Supabase
- Or need to be set up with a migration tool
- This is a one-time fix per database

---

## 🔄 For Other Environments

If you have multiple Supabase projects (dev, staging, prod), you'll need to run this on each:

```sql
-- Run on each environment
ALTER TABLE areas
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS transparency INTEGER DEFAULT 20;
```

The `IF NOT EXISTS` clause makes it safe to run multiple times.

---

## ✅ Expected Result

After running the migration:

```
✓ Added color column to areas table
✓ Added size column to areas table
✓ Added transparency column to areas table

Query returned successfully
```

Then drawing areas should work perfectly!

---

**Quick Summary:**
1. Go to Supabase SQL Editor
2. Paste the ALTER TABLE command above
3. Run it
4. Refresh your app
5. Done! ✅
