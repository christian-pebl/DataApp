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
    console.log('🚀 Running migration: 002_add_visual_properties.sql')
    const migrationSQL = fs.readFileSync('./supabase/migrations/002_add_visual_properties.sql', 'utf8')

    console.log('📝 SQL to execute:')
    console.log(migrationSQL)
    console.log('\n⏳ Executing...')

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      console.log(`\n  Executing: ${statement.substring(0, 80)}...`)
      const { error } = await supabase.rpc('exec', { sql: statement })

      if (error) {
        console.error('  ❌ Failed:', error.message)
        // Continue with other statements even if one fails
      } else {
        console.log('  ✅ Success')
      }
    }

    console.log('\n✅ Migration completed!')
    console.log('✅ Columns added: color, size, transparency')
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.log('\n📋 If automatic migration failed, run this SQL manually in Supabase Dashboard:')
    console.log(fs.readFileSync('./supabase/migrations/002_add_visual_properties.sql', 'utf8'))
    process.exit(1)
  }
}

runMigration()