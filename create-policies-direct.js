const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function createPoliciesDirect() {
  console.log('🔒 Creating RLS policies using direct database connection...')
  
  try {
    // Use a direct PostgreSQL connection approach
    const { Pool } = require('pg')
    
    // Extract connection details from Supabase URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)[1]
    const connectionString = `postgresql://postgres:[YOUR_DB_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`
    
    console.log('❌ Direct PostgreSQL connection requires database password')
    console.log('Let me try a different approach using the management API...')
    
    // Alternative: Use Supabase management API
    const managementToken = process.env.SUPABASE_ACCESS_TOKEN // This would need to be set
    
    if (!managementToken) {
      console.log('❌ No management token available')
      console.log('\n🔧 MANUAL SOLUTION:')
      console.log('Since the SQL Editor is having issues, try these steps:')
      console.log('\n1. Go to your Supabase Dashboard')
      console.log('2. Navigate to Authentication > Policies')
      console.log('3. Find the "pins" table')
      console.log('4. Click "New Policy"')
      console.log('5. Choose "Create a policy from scratch"')
      console.log('6. Use these settings:')
      console.log('')
      console.log('Policy Name: Users can view their own pins')
      console.log('Policy Command: SELECT')
      console.log('Target Role: authenticated')
      console.log('USING expression: user_id::text = (auth.uid())::text')
      console.log('')
      console.log('7. Repeat for INSERT, UPDATE, DELETE with the same expression')
      console.log('')
      console.log('OR try pasting this in a new SQL Editor tab:')
      console.log('')
      console.log('ALTER TABLE pins ENABLE ROW LEVEL SECURITY;')
      console.log('')
      console.log('CREATE POLICY "view_own_pins" ON pins FOR SELECT USING (user_id::text = (auth.uid())::text);')
      console.log('CREATE POLICY "insert_own_pins" ON pins FOR INSERT WITH CHECK (user_id::text = (auth.uid())::text);')
      console.log('CREATE POLICY "update_own_pins" ON pins FOR UPDATE USING (user_id::text = (auth.uid())::text);')
      console.log('CREATE POLICY "delete_own_pins" ON pins FOR DELETE USING (user_id::text = (auth.uid())::text);')
      
      return
    }
    
    // If we had management token, we could use the management API here
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Also let's test if we can create a simple policy using a workaround
async function testSimplePolicy() {
  console.log('\n🧪 Testing if we can create a simple policy...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Try to create a very simple policy using SQL as a string in a query
    const testResult = await supabase
      .from('pins')
      .select('user_id')
      .limit(1)
    
    console.log('✅ Database connection works')
    console.log('Sample user_id:', testResult.data?.[0]?.user_id)
    
    // The issue is that we can't execute DDL (CREATE POLICY) through the REST API
    console.log('\n💡 The solution is to use the Supabase Dashboard UI:')
    console.log('Go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/auth/policies')
    console.log('Click on the pins table')
    console.log('Create policies manually using the UI with this expression:')
    console.log('user_id::text = (auth.uid())::text')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

createPoliciesDirect()
testSimplePolicy()