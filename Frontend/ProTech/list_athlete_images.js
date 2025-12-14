// Script to list all athlete image folders and match them with athlete names
// Shows UUID and corresponding athlete name from database
// Run with: node list_athlete_images.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found at', envPath);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAthleteImages() {
  console.log('🔍 Listing all athlete image folders...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  try {
    // List all folders/files in the athlete-images bucket root
    const { data: items, error: listError } = await supabase.storage
      .from('athlete-images')
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error('❌ Error listing storage:', listError.message);
      if (listError.message.includes('ENOTFOUND') || listError.message.includes('fetch failed')) {
        console.error('\n⚠️  Network connectivity issue detected.');
        console.error('   This might be a DNS or network problem.');
        console.error('   Please check your internet connection and try again.');
      }
      return;
    }

    if (!items || items.length === 0) {
      console.log('No folders found in athlete-images bucket');
      return;
    }

    // Filter to only folders (items without a file extension or that are directories)
    // In Supabase storage, folders are items with metadata indicating they're folders
    // We'll check by trying to list contents of each item
    const folders = [];
    
    console.log(`Found ${items.length} items. Checking which are folders...\n`);
    
    for (const item of items) {
      // Check if this is a folder by trying to list its contents
      const { data: folderContents, error: folderError } = await supabase.storage
        .from('athlete-images')
        .list(item.name, { limit: 1 });
      
      // If we can list contents, it's a folder (or if there's no error, it might be a folder)
      // Also check if the item name looks like a UUID (common pattern)
      if (!folderError || folderContents !== null) {
        folders.push(item.name);
      }
    }

    if (folders.length === 0) {
      console.log('No folders found');
      return;
    }

    console.log(`Found ${folders.length} athlete folders\n`);
    console.log('='.repeat(80));
    console.log('UUID'.padEnd(40) + ' | ' + 'Athlete Name');
    console.log('='.repeat(80));

    // For each folder (UUID), get the athlete name from database
    const results = [];
    
    for (const uuid of folders) {
      try {
        // Query Athlete_Data table for this UUID
        const { data: athleteData, error: dbError } = await supabase
          .from('Athlete_Data')
          .select('id, name')
          .eq('id', uuid)
          .single();

        if (dbError) {
          // If not found in Athlete_Data, try the names table
          const { data: nameData, error: nameError } = await supabase
            .from('names')
            .select('id, name')
            .eq('id', uuid)
            .single();

          if (nameError) {
            results.push({ uuid, name: 'NOT FOUND IN DATABASE' });
            console.log(uuid.padEnd(40) + ' | ' + 'NOT FOUND IN DATABASE');
          } else {
            results.push({ uuid, name: nameData.name });
            console.log(uuid.padEnd(40) + ' | ' + nameData.name);
          }
        } else {
          results.push({ uuid, name: athleteData.name });
          console.log(uuid.padEnd(40) + ' | ' + athleteData.name);
        }
      } catch (error) {
        console.error(`Error querying for ${uuid}:`, error.message);
        results.push({ uuid, name: 'ERROR' });
      }
    }

    console.log('='.repeat(80));
    console.log(`\n✅ Total: ${results.length} athlete folders`);
    console.log(`   Found in database: ${results.filter(r => r.name !== 'NOT FOUND IN DATABASE' && r.name !== 'ERROR').length}`);
    console.log(`   Not found: ${results.filter(r => r.name === 'NOT FOUND IN DATABASE').length}`);
    
    // Also list images in each folder
    console.log('\n📸 Image files in each folder:\n');
    for (const result of results) {
      try {
        const { data: images, error: imgError } = await supabase.storage
          .from('athlete-images')
          .list(result.uuid, { limit: 100 });
        
        if (!imgError && images && images.length > 0) {
          const imageNames = images.map(img => img.name).join(', ');
          console.log(`${result.name} (${result.uuid}):`);
          console.log(`  Images: ${imageNames}`);
          console.log('');
        }
      } catch (error) {
        // Skip if error listing images
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
listAthleteImages().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

