const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
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

async function setupDatabase() {
  try {
    console.log('Setting up database schema...')
    
    // Read SQL file
    const sqlContent = fs.readFileSync(path.join(__dirname, 'setup-database.sql'), 'utf8')
    
    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...')
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error) {
          console.error('Error executing statement:', error)
        }
      }
    }
    
    console.log('Database setup completed!')
    
    // Test the connection by trying to create a simple query
    const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true })
    if (error) {
      console.error('Error testing connection:', error)
    } else {
      console.log('Database connection successful!')
    }
    
  } catch (error) {
    console.error('Setup failed:', error)
  }
}

setupDatabase()