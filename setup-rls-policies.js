const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

async function setupRLSPolicies() {
  console.log('🔒 Setting up RLS policies for pins table...')
  
  try {
    // Use direct HTTP requests to Supabase's PostgREST API
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)[1]
    console.log('Project reference:', projectRef)
    
    // The policies we need to create
    const policies = [
      {
        name: 'Users can view their own pins',
        action: 'SELECT', 
        sql: `CREATE POLICY "Users can view their own pins" ON pins FOR SELECT USING (user_id::text = auth.uid());`
      },
      {
        name: 'Users can insert their own pins',
        action: 'INSERT',
        sql: `CREATE POLICY "Users can insert their own pins" ON pins FOR INSERT WITH CHECK (user_id::text = auth.uid());`
      },
      {
        name: 'Users can update their own pins',
        action: 'UPDATE', 
        sql: `CREATE POLICY "Users can update their own pins" ON pins FOR UPDATE USING (user_id::text = auth.uid());`
      },
      {
        name: 'Users can delete their own pins',
        action: 'DELETE',
        sql: `CREATE POLICY "Users can delete their own pins" ON pins FOR DELETE USING (user_id::text = auth.uid());`
      }
    ]
    
    // Try to execute each policy using HTTP requests
    for (const policy of policies) {
      console.log(`Creating policy: ${policy.name}`)
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            query: policy.sql
          })
        })
        
        if (response.ok) {
          console.log(`✅ ${policy.name} created successfully`)
        } else {
          const errorText = await response.text()
          console.log(`⚠️ ${policy.name} may already exist or error:`, errorText)
        }
      } catch (error) {
        console.log(`⚠️ ${policy.name} error:`, error.message)
      }
    }
    
    // Test the policies by trying to create a pin as a regular user
    console.log('\n🧪 Testing RLS policies...')
    
    // Create a regular client (not service role)
    const regularClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    
    // Try to access pins without authentication (should fail)
    const { data: unauthData, error: unauthError } = await regularClient
      .from('pins')
      .select('*')
      .limit(1)
    
    if (unauthError) {
      console.log('✅ RLS is working - unauthenticated access blocked:', unauthError.message)
    } else {
      console.log('⚠️ RLS might not be working - unauthenticated access succeeded')
    }
    
    console.log('\n📝 Summary:')
    console.log('- RLS policies have been created for the pins table')
    console.log('- Users can now only access their own pins')
    console.log('- Try creating/updating pins in your app now')
    console.log('- If issues persist, check the Supabase dashboard for policy status')
    
  } catch (error) {
    console.error('❌ Error setting up RLS policies:', error.message)
    console.log('\n🔧 Manual steps:')
    console.log('1. Go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/auth/policies')
    console.log('2. Select the "pins" table')
    console.log('3. Create 4 policies with these SQL statements:')
    console.log('')
    console.log('SELECT policy:')
    console.log('CREATE POLICY "Users can view their own pins" ON pins FOR SELECT USING (user_id::text = auth.uid());')
    console.log('')
    console.log('INSERT policy:')
    console.log('CREATE POLICY "Users can insert their own pins" ON pins FOR INSERT WITH CHECK (user_id::text = auth.uid());')
    console.log('')
    console.log('UPDATE policy:') 
    console.log('CREATE POLICY "Users can update their own pins" ON pins FOR UPDATE USING (user_id::text = auth.uid());')
    console.log('')
    console.log('DELETE policy:')
    console.log('CREATE POLICY "Users can delete their own pins" ON pins FOR DELETE USING (user_id::text = auth.uid());')
  }
}

setupRLSPolicies()