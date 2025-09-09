# How to Enable the Sharing Feature

The sharing feature is fully implemented in the code but the database tables need to be created. Follow these steps:

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Copy and paste the entire contents of: `supabase/migrations/20250908_create_sharing_tables.sql`
6. Click **Run** to execute the migration
7. You should see "Success" messages for each table created

## Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
cd data-app-sep25
npx supabase db push
```

## Verify Installation

After running the migration, test that it worked:

1. Go to http://localhost:9003
2. Create or select a pin
3. Click the share button
4. Try generating a public link

The tables created are:
- `pin_shares` - For user-to-user sharing
- `share_tokens` - For public link sharing  
- `share_analytics` - For tracking share usage
- `profiles` - User profiles (may already exist)

## Troubleshooting

If you get errors:
- Make sure you're using the correct Supabase project
- Check that the `pins` table exists first
- The migration includes "IF NOT EXISTS" so it's safe to run multiple times