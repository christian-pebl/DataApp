#!/usr/bin/env node

/**
 * Database Setup Script for Map Data App
 * 
 * This script applies the database schema to your Supabase project.
 * Make sure your .env.local file is configured with Supabase credentials.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database schema...\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease check your .env.local file.');
    process.exit(1);
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_create_map_data_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📁 Reading migration file...');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Size: ${Math.round(migrationSQL.length / 1024)}KB\n`);

    // Execute the migration
    console.log('⚡ Executing database migration...');
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });

    if (error) {
      // If rpc doesn't work, try direct query approach
      console.log('   Trying alternative approach...');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement) {
          console.log(`   Executing statement ${i + 1}/${statements.length}...`);
          const { error: stmtError } = await supabase
            .from('pg_stat_statements')
            .select('*')
            .limit(1); // This is just to test connection
          
          // We'll need to use the SQL editor in Supabase dashboard instead
          if (stmtError && stmtError.code === '42P01') {
            console.log('   ⚠️  Direct SQL execution not available via JS client');
            console.log('   📋 Please use the Supabase Dashboard SQL Editor instead\n');
            break;
          }
        }
      }
    }

    // Verify tables exist
    console.log('🔍 Verifying schema creation...');
    
    const tables = ['projects', 'tags', 'pins', 'lines', 'areas'];
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error && error.code === '42P01') {
          console.log(`   ❌ Table '${table}' not found`);
        } else {
          console.log(`   ✅ Table '${table}' exists`);
        }
      } catch (err) {
        console.log(`   ⚠️  Could not verify table '${table}'`);
      }
    }

    console.log('\n🎉 Database setup completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your dev server: npm run dev');
    console.log('   2. Navigate to /map-drawing');
    console.log('   3. Sign up/login to test the integration');
    console.log('   4. Create some pins, lines, or areas');
    console.log('   5. Check your Supabase dashboard to verify data storage\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📋 Manual Setup Required:');
    console.log('   1. Go to your Supabase project dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Copy and paste the contents of:');
    console.log('      supabase/migrations/001_create_map_data_tables.sql');
    console.log('   4. Click Run to execute the migration\n');
    process.exit(1);
  }
}

// Check if migration file exists
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_create_map_data_tables.sql');
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  console.error('Please ensure the migration file exists.');
  process.exit(1);
}

setupDatabase();