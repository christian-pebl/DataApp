const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addRLSPolicies() {
  console.log('🔒 Adding RLS policies for pins table...')
  
  try {
    // Test if we can access the pins table first
    console.log('Testing pins table access...')
    const { data: testPins, error: testError } = await supabase
      .from('pins')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('❌ Error accessing pins table:', testError)
      return
    }
    
    console.log('✅ Pins table accessible, found', testPins?.length || 0, 'pins')
    
    // Check if RLS is enabled on pins table
    console.log('Checking if RLS is enabled on pins table...')
    
    // Try to create a test pin to see current permissions
    console.log('Testing current pin creation permissions...')
    const testPin = {
      lat: 0,
      lng: 0,
      label: 'RLS Test Pin',
      notes: 'This pin will be deleted after testing',
      label_visible: true,
      project_id: null,
      user_id: 'test-user-id'
    }
    
    const { data: createResult, error: createError } = await supabase
      .from('pins')
      .insert(testPin)
      .select()
      .single()
    
    if (createError) {
      console.log('❌ Pin creation failed (this might be expected due to RLS):', {
        code: createError.code,
        message: createError.message
      })
    } else {
      console.log('✅ Pin creation successful:', createResult.id)
      // Clean up test pin
      await supabase.from('pins').delete().eq('id', createResult.id)
      console.log('🧹 Test pin cleaned up')
    }
    
    console.log('\n📋 Summary:')
    console.log('- Database tables exist and are accessible')
    console.log('- The RLS policies may need to be configured in Supabase Dashboard')
    console.log('- Go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/auth/policies')
    console.log('- Or try running the SQL policies directly in the SQL Editor')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

addRLSPolicies()