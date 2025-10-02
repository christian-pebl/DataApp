const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key_here') {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not configured in .env.local')
  console.error('')
  console.error('To get your service role key:')
  console.error('1. Go to Supabase Dashboard > Settings > API')
  console.error('2. Under "Project API keys", find "service_role" key')
  console.error('3. Click "Reveal" and copy the key')
  console.error('4. Add it to .env.local: SUPABASE_SERVICE_ROLE_KEY=your_actual_key')
  console.error('')
  console.error('Alternatively, run this SQL in Supabase SQL Editor:')
  console.error('NOTIFY pgrst, \'reload schema\';')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function reloadSchema() {
  console.log('🔄 Attempting to reload Supabase schema cache...\n')

  try {
    // Try using the NOTIFY command via SQL execution
    const { data, error } = await supabase.rpc('exec', {
      sql: "NOTIFY pgrst, 'reload schema'"
    })

    if (error) {
      console.error('❌ Failed to reload schema via RPC:', error.message)
      console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
      console.log("NOTIFY pgrst, 'reload schema';")
      console.log('\nOr go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql')
    } else {
      console.log('✅ Schema reload command sent successfully!')
      console.log('   Wait 5-10 seconds, then try creating/editing areas again.')
    }
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
    console.log("NOTIFY pgrst, 'reload schema';")
    console.log('\nOr go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql')
  }
}

reloadSchema()
