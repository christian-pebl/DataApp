// Direct SQL execution using Supabase Management API
import { config } from 'dotenv';
config({ path: '.env.local' });

const projectRef = 'tujjhrliibqgstbrohfn';
const accessToken = 'sbp_2be628c4f0828be198f96d237663d68832725a8b';

const sql = `
ALTER TABLE pins ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true;
ALTER TABLE lines ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS pins_object_visible_idx ON pins(object_visible);
CREATE INDEX IF NOT EXISTS lines_object_visible_idx ON lines(object_visible);
CREATE INDEX IF NOT EXISTS areas_object_visible_idx ON areas(object_visible);
`;

console.log('🚀 Attempting to run SQL via Supabase Management API...\n');

try {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('❌ API returned error:', response.status);
    console.log(error);
    console.log('\n📋 Please run this SQL manually in Supabase Dashboard → SQL Editor:');
    console.log('   https://tujjhrliibqgstbrohfn.supabase.co/project/_/sql\n');
    console.log(sql);
  } else {
    const data = await response.json();
    console.log('✅ Success! Migration applied.');
    console.log(data);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  console.log('\n📋 Please run this SQL manually in Supabase Dashboard → SQL Editor:');
  console.log('   https://tujjhrliibqgstbrohfn.supabase.co/project/_/sql\n');
  console.log(sql);
}
