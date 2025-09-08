// Comprehensive test for pin operations with different users
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Test configuration
const TEST_USERS = [
  {
    email: 'christian@pebl-cic.co.uk',
    password: 'Mewslade123@',
    name: 'PEBL User'
  },
  {
    email: 'christiannberger@gmail.com', 
    password: 'Mewslade123@',
    name: 'Gmail User'
  }
]

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
}

async function testPinOperations() {
  console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.blue}     PIN OPERATIONS TEST FOR MULTIPLE USERS${colors.reset}`)
  console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}\n`)

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  for (const testUser of TEST_USERS) {
    console.log(`${colors.magenta}┌─────────────────────────────────────────────┐${colors.reset}`)
    console.log(`${colors.magenta}│  Testing User: ${testUser.name.padEnd(28)}│${colors.reset}`)
    console.log(`${colors.magenta}│  Email: ${testUser.email.padEnd(35)}│${colors.reset}`)
    console.log(`${colors.magenta}└─────────────────────────────────────────────┘${colors.reset}\n`)
    
    // Skip if password not provided
    if (testUser.password === 'your_password_here') {
      console.log(`${colors.yellow}⚠️  Skipping ${testUser.name} - Please provide password in the script${colors.reset}\n`)
      continue
    }
    
    try {
      // 1. Sign in
      console.log(`${colors.blue}1. Signing in...${colors.reset}`)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      })
      
      if (authError) {
        console.log(`${colors.red}   ❌ Sign in failed: ${authError.message}${colors.reset}`)
        continue
      }
      console.log(`${colors.green}   ✅ Signed in successfully${colors.reset}`)
      console.log(`   User ID: ${authData.user.id}`)
      
      // 2. Create a test pin with a name
      const testPinName = `Test Pin - ${testUser.name} - ${new Date().toISOString()}`
      const testLat = 51.5 + Math.random() * 0.1
      const testLng = -0.1 + Math.random() * 0.1
      
      console.log(`\n${colors.blue}2. Creating pin with name...${colors.reset}`)
      console.log(`   Pin name: "${testPinName}"`)
      console.log(`   Location: ${testLat.toFixed(6)}, ${testLng.toFixed(6)}`)
      
      const { data: createdPin, error: createError } = await supabase
        .from('pins')
        .insert({
          lat: testLat,
          lng: testLng,
          label: testPinName,
          user_id: authData.user.id,
          notes: 'Test pin created by automated test'
        })
        .select()
        .single()
      
      if (createError) {
        console.log(`${colors.red}   ❌ Pin creation failed: ${createError.message}${colors.reset}`)
      } else {
        console.log(`${colors.green}   ✅ Pin created successfully${colors.reset}`)
        console.log(`   Pin ID: ${createdPin.id}`)
        
        // 3. Verify pin can be retrieved with its name
        console.log(`\n${colors.blue}3. Retrieving pin to verify name...${colors.reset}`)
        const { data: retrievedPin, error: retrieveError } = await supabase
          .from('pins')
          .select('*')
          .eq('id', createdPin.id)
          .single()
        
        if (retrieveError) {
          console.log(`${colors.red}   ❌ Pin retrieval failed: ${retrieveError.message}${colors.reset}`)
        } else if (retrievedPin.label === testPinName) {
          console.log(`${colors.green}   ✅ Pin name verified: "${retrievedPin.label}"${colors.reset}`)
        } else {
          console.log(`${colors.red}   ❌ Pin name mismatch!${colors.reset}`)
          console.log(`      Expected: "${testPinName}"`)
          console.log(`      Got: "${retrievedPin.label}"`)
        }
        
        // 4. Update pin name
        const updatedPinName = `Updated - ${testPinName}`
        console.log(`\n${colors.blue}4. Updating pin name...${colors.reset}`)
        console.log(`   New name: "${updatedPinName}"`)
        
        const { data: updatedPin, error: updateError } = await supabase
          .from('pins')
          .update({ label: updatedPinName })
          .eq('id', createdPin.id)
          .select()
          .single()
        
        if (updateError) {
          console.log(`${colors.red}   ❌ Pin update failed: ${updateError.message}${colors.reset}`)
        } else if (updatedPin.label === updatedPinName) {
          console.log(`${colors.green}   ✅ Pin name updated successfully${colors.reset}`)
        } else {
          console.log(`${colors.red}   ❌ Pin update didn't persist${colors.reset}`)
        }
        
        // 5. List all pins for this user
        console.log(`\n${colors.blue}5. Listing all pins for user...${colors.reset}`)
        const { data: allPins, error: listError } = await supabase
          .from('pins')
          .select('id, label, created_at')
          .order('created_at', { ascending: false })
        
        if (listError) {
          console.log(`${colors.red}   ❌ Pin listing failed: ${listError.message}${colors.reset}`)
        } else {
          console.log(`${colors.green}   ✅ Found ${allPins.length} pins for this user${colors.reset}`)
          allPins.slice(0, 3).forEach(pin => {
            console.log(`      - ${pin.label || '(no name)'} (${pin.id.substring(0, 8)}...)`)
          })
        }
        
        // 6. Clean up - delete test pin
        console.log(`\n${colors.blue}6. Cleaning up test pin...${colors.reset}`)
        const { error: deleteError } = await supabase
          .from('pins')
          .delete()
          .eq('id', createdPin.id)
        
        if (deleteError) {
          console.log(`${colors.yellow}   ⚠️  Cleanup failed: ${deleteError.message}${colors.reset}`)
        } else {
          console.log(`${colors.green}   ✅ Test pin deleted${colors.reset}`)
        }
      }
      
      // 7. Sign out
      console.log(`\n${colors.blue}7. Signing out...${colors.reset}`)
      await supabase.auth.signOut()
      console.log(`${colors.green}   ✅ Signed out${colors.reset}`)
      
    } catch (error) {
      console.log(`${colors.red}❌ Unexpected error: ${error.message}${colors.reset}`)
    }
    
    console.log(`\n${colors.magenta}═══════════════════════════════════════════════${colors.reset}\n`)
  }
  
  // Summary
  console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.blue}                    TEST COMPLETE${colors.reset}`)
  console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`\n${colors.green}✅ Key things to verify:${colors.reset}`)
  console.log('   1. Pins can be created with names')
  console.log('   2. Pin names persist after creation')
  console.log('   3. Pin names can be updated')
  console.log('   4. Each user only sees their own pins')
  console.log('   5. No RLS policy errors occur')
}

// Run the test
testPinOperations().catch(console.error)