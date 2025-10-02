const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key_here') {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not configured in .env.local')
  console.error('   Please add your service role key from Supabase dashboard')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function verifyColumns() {
  console.log('🔍 Verifying columns in database...\n')

  // Check areas table columns
  console.log('📋 Checking areas table columns:')
  const { data: areaData, error: areaError } = await supabase
    .from('areas')
    .select('*')
    .limit(1)

  if (areaError) {
    console.error('❌ Error querying areas:', areaError.message)
  } else {
    if (areaData && areaData.length > 0) {
      console.log('   Columns found:', Object.keys(areaData[0]).join(', '))
    } else {
      console.log('   ⚠️  No data in areas table to verify columns')
    }
  }

  // Check lines table columns
  console.log('\n📋 Checking lines table columns:')
  const { data: lineData, error: lineError } = await supabase
    .from('lines')
    .select('*')
    .limit(1)

  if (lineError) {
    console.error('❌ Error querying lines:', lineError.message)
  } else {
    if (lineData && lineData.length > 0) {
      console.log('   Columns found:', Object.keys(lineData[0]).join(', '))
    } else {
      console.log('   ⚠️  No data in lines table to verify columns')
    }
  }

  console.log('\n✅ If you see the error about schema cache, you need to:')
  console.log('   1. Go to Supabase Dashboard > API Settings')
  console.log('   2. Click "Reload schema cache" button')
  console.log('   OR wait a few minutes for automatic refresh')
}

verifyColumns()
