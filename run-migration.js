const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Read environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runMigration() {
  try {
    console.log('Reading migration file...')
    const migrationSQL = fs.readFileSync('./supabase/migrations/001_create_map_data_tables.sql', 'utf8')
    
    console.log('Running migration...')
    const { data, error } = await supabase.rpc('exec', { sql: migrationSQL })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Migration completed successfully!')
    console.log('Result:', data)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

runMigration()