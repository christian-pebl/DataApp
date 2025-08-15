# Supabase Database Setup Instructions

## Prerequisites
1. Supabase project created at [supabase.com](https://supabase.com)
2. Environment variables configured in `.env.local`

## Step 1: Apply Database Schema

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `migrations/001_create_map_data_tables.sql`
5. Click **Run** to execute the migration

### Option B: Using Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Initialize Supabase in your project (if not already done)
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

## Step 2: Verify Schema Creation

After running the migration, verify in your Supabase dashboard:

1. Go to **Database** → **Tables**
2. You should see these new tables:
   - `projects`
   - `tags` 
   - `pins`
   - `lines`
   - `areas`
   - `pin_tags`
   - `line_tags`
   - `area_tags`

3. Go to **Authentication** → **Policies**
4. Verify RLS policies are active for all tables

## Step 3: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/map-drawing`

3. Sign up/Login to test authenticated features

4. Try creating pins, lines, and areas

5. Check Supabase dashboard to verify data is being stored

## Troubleshooting

### Environment Variables
Ensure these are set in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### Common Issues
- **Authentication errors**: Check your Supabase URL and keys
- **Permission denied**: Ensure RLS policies were created correctly
- **Migration errors**: Check SQL syntax and run queries individually

### Schema Reset (if needed)
If you need to reset the schema:
```sql
-- Drop all tables (in order to handle foreign keys)
DROP TABLE IF EXISTS area_tags;
DROP TABLE IF EXISTS line_tags;
DROP TABLE IF EXISTS pin_tags;
DROP TABLE IF EXISTS areas;
DROP TABLE IF EXISTS lines;
DROP TABLE IF EXISTS pins;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS projects;
```

## Next Steps
After successful schema setup:
1. Test the map drawing functionality
2. Verify data persistence across sessions
3. Test the migration from localStorage to database
4. Deploy to production with proper environment variables