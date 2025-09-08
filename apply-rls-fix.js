const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function applyRLSFix() {
  console.log('🔧 Starting RLS Policy Fix Application...')
  
  // Create Supabase client with service role key for admin operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
    console.error('   Please check your .env.local file')
    return
  }
  
  console.log('✅ Environment variables loaded')
  console.log('   Supabase URL:', supabaseUrl)
  console.log('   Service Key:', supabaseServiceKey.substring(0, 10) + '...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Read the SQL file
  const sqlFilePath = path.join(__dirname, 'fix-rls-policies.sql')
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error('❌ SQL file not found:', sqlFilePath)
    return
  }
  
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')
  console.log('✅ SQL file loaded, length:', sqlContent.length, 'characters')
  
  // Split SQL into individual statements (by semicolons and newlines)
  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
  
  console.log('📝 Found', statements.length, 'SQL statements to execute')
  
  let successCount = 0
  let errorCount = 0
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}...`)
    console.log('   Statement preview:', statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message)
        console.error('   Full error:', error)
        errorCount++
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`)
        successCount++
      }
    } catch (err) {
      // Try direct query if RPC doesn't work
      try {
        const { data, error } = await supabase
          .from('dummy') // This will fail but might give us better error info
          .select('*')
        
        // Use raw SQL execution approach
        console.log('⚠️  Trying alternative execution method...')
        // Note: We can't execute raw SQL from client, need to use Supabase dashboard
        console.log('   Statement would need to be run in Supabase SQL editor:', statement)
        
      } catch (altError) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, err.message)
        errorCount++
      }
    }
  }
  
  console.log('\n🎯 RLS Policy Fix Application Summary:')
  console.log('   ✅ Successful statements:', successCount)
  console.log('   ❌ Failed statements:', errorCount)
  console.log('   📊 Total statements:', statements.length)
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. You may need to:')
    console.log('   1. Run the SQL manually in Supabase Dashboard > SQL Editor')
    console.log('   2. Check that all required tables exist')
    console.log('   3. Verify your service role key has proper permissions')
    console.log('\n🔗 Supabase Dashboard: https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0])
  } else {
    console.log('\n🎉 All RLS policies applied successfully!')
    console.log('   🔄 Please refresh your application and test pin operations')
  }
}

// Handle both direct execution and module usage
if (require.main === module) {
  applyRLSFix().catch(console.error)
}

module.exports = { applyRLSFix }