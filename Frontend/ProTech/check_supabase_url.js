// Helper script to check and update Supabase URL
// Run with: node check_supabase_url.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');

console.log('📋 Current Supabase Configuration:\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  console.log('\n💡 Create a .env file with:');
  console.log('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('   VITE_SUPABASE_ANON_KEY=your_anon_key');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const currentUrl = urlMatch?.[1]?.trim();
const currentKey = keyMatch?.[1]?.trim();

console.log('Current URL:', currentUrl || '❌ Not set');
console.log('Current Key:', currentKey ? '✓ Set (first 20 chars: ' + currentKey.substring(0, 20) + '...)' : '❌ Not set');
console.log('\n');

if (!currentUrl) {
  console.error('❌ VITE_SUPABASE_URL is not set in .env file');
  process.exit(1);
}

// Test the URL
console.log('🔍 Testing Supabase URL...\n');

try {
  const response = await fetch(currentUrl + '/rest/v1/', {
    method: 'GET',
    headers: {
      'apikey': currentKey || '',
      'Authorization': `Bearer ${currentKey || ''}`
    }
  });
  
  if (response.ok) {
    console.log('✅ URL is valid and accessible!');
    console.log('   Status:', response.status);
    console.log('\n✅ Your Supabase configuration is correct.');
    console.log('   You can now run: node update_names_from_roster.js');
  } else {
    console.log('⚠️  URL responded but with status:', response.status);
    console.log('   This might indicate an authentication issue.');
  }
} catch (error) {
  console.error('❌ URL is not accessible:', error.message);
  console.log('\n💡 How to fix this:');
  console.log('\n1. Go to your Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard');
  console.log('\n2. Select your project');
  console.log('\n3. Go to Settings → API');
  console.log('\n4. Copy the "Project URL" (should look like: https://xxxxx.supabase.co)');
  console.log('\n5. Copy the "anon public" key');
  console.log('\n6. Update your .env file with the correct values:');
  console.log('   VITE_SUPABASE_URL=https://xxxxx.supabase.co');
  console.log('   VITE_SUPABASE_ANON_KEY=your_anon_key_here');
  console.log('\n7. Make sure there is NO trailing slash on the URL');
  console.log('\n8. If your project is paused, go to Settings → General and resume it');
  
  if (error.message.includes('resolve')) {
    console.log('\n⚠️  DNS Resolution Error:');
    console.log('   - The domain cannot be resolved');
    console.log('   - Check if the project URL is correct');
    console.log('   - Verify the project is not deleted or paused');
  }
  
  process.exit(1);
}

