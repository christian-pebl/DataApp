const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function checkPinLabels() {
  console.log('\n=== CHECKING PIN LABELS IN DATABASE ===\n')
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  // Test with both users
  const users = [
    { email: 'christian@pebl-cic.co.uk', password: 'Mewslade123@' },
    { email: 'christiannberger@gmail.com', password: 'Mewslade123@' }
  ]
  
  for (const user of users) {
    console.log(`\nChecking pins for: ${user.email}`)
    console.log('=' .repeat(50))
    
    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    })
    
    if (authError) {
      console.log(`❌ Login failed: ${authError.message}`)
      continue
    }
    
    console.log(`✅ Logged in as ${user.email}`)
    console.log(`User ID: ${authData.user.id}`)
    
    // Get all pins for this user
    const { data: pins, error: pinsError } = await supabase
      .from('pins')
      .select('id, label, notes, created_at, lat, lng')
      .order('created_at', { ascending: false })
    
    if (pinsError) {
      console.log(`❌ Error fetching pins: ${pinsError.message}`)
    } else {
      console.log(`\nFound ${pins.length} pins:`)
      pins.forEach((pin, index) => {
        console.log(`\n  Pin ${index + 1}:`)
        console.log(`    ID: ${pin.id}`)
        console.log(`    Label: ${pin.label ? `"${pin.label}"` : '(NULL)'}`)
        console.log(`    Notes: ${pin.notes ? `"${pin.notes.substring(0, 50)}..."` : '(NULL)'}`)
        console.log(`    Location: ${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`)
        console.log(`    Created: ${new Date(pin.created_at).toLocaleString()}`)
      })
      
      // Count pins with and without labels
      const withLabels = pins.filter(p => p.label && p.label.trim() !== '').length
      const withoutLabels = pins.filter(p => !p.label || p.label.trim() === '').length
      
      console.log(`\n  Summary:`)
      console.log(`    Pins with labels: ${withLabels}`)
      console.log(`    Pins without labels: ${withoutLabels}`)
    }
    
    // Sign out
    await supabase.auth.signOut()
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('CHECK COMPLETE')
}

checkPinLabels().catch(console.error)