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

async function createMissingTables() {
  console.log('🚀 Creating missing database tables...')
  
  try {
    // Test each table by trying to select from it
    const tables = ['projects', 'tags', 'lines', 'areas', 'pin_tags', 'line_tags', 'area_tags']
    const missingTables = []
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1)
        if (error && error.code === 'PGRST205') {
          missingTables.push(table)
          console.log(`❌ Table '${table}' is missing`)
        } else {
          console.log(`✅ Table '${table}' exists`)
        }
      } catch (err) {
        missingTables.push(table)
        console.log(`❌ Table '${table}' is missing (error: ${err.message})`)
      }
    }
    
    if (missingTables.length === 0) {
      console.log('🎉 All tables exist!')
      return
    }
    
    console.log(`\n📝 Creating ${missingTables.length} missing tables...`)
    
    // Create missing tables using raw SQL
    const sqlStatements = []
    
    if (missingTables.includes('projects')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)
    }
    
    if (missingTables.includes('tags')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS tags (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)
    }
    
    if (missingTables.includes('lines')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS lines (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          path JSONB NOT NULL,
          label TEXT NOT NULL,
          notes TEXT,
          label_visible BOOLEAN DEFAULT true,
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)
    }
    
    if (missingTables.includes('areas')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS areas (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          path JSONB NOT NULL,
          label TEXT NOT NULL,
          notes TEXT,
          label_visible BOOLEAN DEFAULT true,
          fill_visible BOOLEAN DEFAULT true,
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)
    }
    
    if (missingTables.includes('pin_tags')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS pin_tags (
          pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
          tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (pin_id, tag_id)
        );
      `)
    }
    
    if (missingTables.includes('line_tags')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS line_tags (
          line_id UUID REFERENCES lines(id) ON DELETE CASCADE,
          tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (line_id, tag_id)
        );
      `)
    }
    
    if (missingTables.includes('area_tags')) {
      sqlStatements.push(`
        CREATE TABLE IF NOT EXISTS area_tags (
          area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
          tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (area_id, tag_id)
        );
      `)
    }
    
    // Execute SQL statements using supabase-js sql template
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i].trim()
      console.log(`⚡ Executing SQL statement ${i + 1}/${sqlStatements.length}...`)
      
      try {
        // Use the REST API directly to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            sql: sql
          })
        })
        
        if (response.ok) {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        } else {
          const error = await response.text()
          console.error(`❌ Statement ${i + 1} failed:`, error)
        }
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message)
      }
    }
    
    console.log('\n🎉 Table creation completed!')
    console.log('Please refresh your application to test the database operations.')
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
  }
}

createMissingTables()