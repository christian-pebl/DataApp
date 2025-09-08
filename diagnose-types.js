const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function diagnoseTypes() {
  console.log('🔍 Diagnosing data types for RLS policies...')
  
  try {
    // Get information about the pins table structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec', { 
        sql: `
          SELECT column_name, data_type, udt_name 
          FROM information_schema.columns 
          WHERE table_name = 'pins' AND column_name = 'user_id';
        `
      })
    
    if (tableError) {
      console.log('❌ Cannot access table info via RPC. Let\'s try a different approach.')
      
      // Try to get a sample pin to understand the structure
      const { data: samplePin, error: sampleError } = await supabase
        .from('pins')
        .select('user_id')
        .limit(1)
        .single()
      
      if (sampleError) {
        console.log('❌ Cannot get sample pin:', sampleError)
      } else {
        console.log('✅ Sample pin user_id:', samplePin.user_id, typeof samplePin.user_id)
      }
    } else {
      console.log('✅ Table info:', tableInfo)
    }
    
    // Test auth.uid() function directly
    console.log('\n🧪 Testing auth.uid() function...')
    
    // Create policies with different casting approaches
    const policyTests = [
      {
        name: 'Test 1: No casting',
        sql: `CREATE POLICY "test_policy_1" ON pins FOR SELECT USING (user_id = auth.uid());`
      },
      {
        name: 'Test 2: Cast auth.uid() to UUID',
        sql: `CREATE POLICY "test_policy_2" ON pins FOR SELECT USING (user_id = auth.uid()::uuid);`
      },
      {
        name: 'Test 3: Cast user_id to text',
        sql: `CREATE POLICY "test_policy_3" ON pins FOR SELECT USING (user_id::text = auth.uid());`
      },
      {
        name: 'Test 4: Cast both to text',
        sql: `CREATE POLICY "test_policy_4" ON pins FOR SELECT USING (user_id::text = auth.uid()::text);`
      }
    ]
    
    for (const test of policyTests) {
      console.log(`\nTrying ${test.name}...`)
      
      try {
        // First clean up any existing test policy
        await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            sql: `DROP POLICY IF EXISTS "${test.name.split(':')[0].trim().toLowerCase().replace(' ', '_')}_policy" ON pins;`
          })
        })
        
        // Try the policy creation
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            sql: test.sql
          })
        })
        
        if (response.ok) {
          console.log(`✅ ${test.name} - SUCCESS! This casting approach works.`)
          
          // Clean up the test policy
          await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              sql: test.sql.replace('CREATE POLICY', 'DROP POLICY IF EXISTS').replace(' ON pins FOR SELECT USING', ' ON pins;').split('(')[0] + ';'
            })
          })
          
          break // Stop testing once we find a working approach
        } else {
          const error = await response.text()
          console.log(`❌ ${test.name} - Failed: ${error.substring(0, 100)}...`)
        }
        
      } catch (error) {
        console.log(`❌ ${test.name} - Error: ${error.message}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message)
  }
}

diagnoseTypes()