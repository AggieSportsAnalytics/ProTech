// Script to rename athlete image folders from UUID to "Player Name-UUID"
// Run with: node rename_athlete_folders.js

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

// Sanitize folder name (remove invalid characters for file paths)
function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars with dash
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

async function renameAthleteFolders() {
  console.log('🔄 Starting folder renaming process...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  try {
    // List all folders in the athlete-images bucket
    const { data: items, error: listError } = await supabase.storage
      .from('athlete-images')
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error('❌ Error listing storage:', listError.message);
      return;
    }

    if (!items || items.length === 0) {
      console.log('No folders found in athlete-images bucket');
      return;
    }

    // Filter to only folders (items that can be listed)
    const folders = [];
    console.log(`Found ${items.length} items. Checking which are folders...\n`);
    
    for (const item of items) {
      const { data: folderContents, error: folderError } = await supabase.storage
        .from('athlete-images')
        .list(item.name, { limit: 1 });
      
      if (!folderError || folderContents !== null) {
        folders.push(item.name);
      }
    }

    if (folders.length === 0) {
      console.log('No folders found');
      return;
    }

    console.log(`Found ${folders.length} athlete folders\n`);

    // Get all athlete data from names_backup table only
    const { data: allNames, error: namesError } = await supabase
      .from('names_backup')
      .select('id, name');

    if (namesError) {
      console.error('❌ Error loading names_backup:', namesError.message);
      return;
    }

    // Create lookup map from names_backup only
    const nameMap = new Map();
    
    if (allNames) {
      allNames.forEach(name => {
        nameMap.set(name.id.toLowerCase(), name.name);
      });
    }

    console.log(`Loaded ${nameMap.size} names from names_backup table\n`);
    console.log('='.repeat(80));
    console.log('Processing folders...\n');

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < folders.length; i++) {
      const uuid = folders[i];
      const uuidLower = uuid.toLowerCase();
      
      // Get athlete name
      const athleteName = nameMap.get(uuidLower);
      
      if (!athleteName) {
        console.log(`[${i + 1}/${folders.length}] ⏭️  Skipping ${uuid} - NOT FOUND IN DATABASE`);
        skippedCount++;
        continue;
      }

      // Create new folder name: "Player Name-UUID"
      const sanitizedName = sanitizeFolderName(athleteName);
      const newFolderName = `${sanitizedName}-${uuid}`;

      // Check if new folder already exists
      const { data: existingFolder } = await supabase.storage
        .from('athlete-images')
        .list(newFolderName, { limit: 1 });

      if (existingFolder && existingFolder.length > 0) {
        console.log(`[${i + 1}/${folders.length}] ⏭️  Skipping ${uuid} - ${newFolderName} already exists`);
        skippedCount++;
        continue;
      }

      try {
        // List all files in the old folder
        const { data: files, error: filesError } = await supabase.storage
          .from('athlete-images')
          .list(uuid, { limit: 1000 });

        if (filesError) {
          console.log(`[${i + 1}/${folders.length}] ❌ Error listing files in ${uuid}: ${filesError.message}`);
          errorCount++;
          continue;
        }

        if (!files || files.length === 0) {
          console.log(`[${i + 1}/${folders.length}] ⚠️  No files in ${uuid}, skipping`);
          skippedCount++;
          continue;
        }

        console.log(`[${i + 1}/${folders.length}] 📁 Copying: ${uuid} → ${newFolderName} (${files.length} files)`);

        // Copy each file to the new folder
        let filesCopied = 0;
        for (const file of files) {
          const oldPath = `${uuid}/${file.name}`;
          const newPath = `${newFolderName}/${file.name}`;

          // Download the file
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('athlete-images')
            .download(oldPath);

          if (downloadError) {
            console.log(`   ⚠️  Error downloading ${oldPath}: ${downloadError.message}`);
            continue;
          }

          // Upload to new location
          const { error: uploadError } = await supabase.storage
            .from('athlete-images')
            .upload(newPath, fileData, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.log(`   ⚠️  Error uploading ${newPath}: ${uploadError.message}`);
            continue;
          }

          filesCopied++;
        }

        if (filesCopied === files.length) {
          // All files copied successfully (old folder kept intact)
          console.log(`   ✅ Successfully copied folder (${filesCopied} files copied, old folder preserved)`);
          successCount++;
        } else {
          console.log(`   ⚠️  Only ${filesCopied}/${files.length} files copied`);
          errorCount++;
        }

      } catch (error) {
        console.log(`[${i + 1}/${folders.length}] ❌ Error processing ${uuid}: ${error.message}`);
        errorCount++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Copying complete!');
    console.log(`   Successfully copied: ${successCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`\n📁 New folders created with naming: "Player Name-UUID"`);
    console.log(`   Old folders (UUID only) are preserved`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
console.log('⚠️  WARNING: This will copy all folders in the athlete-images bucket.');
console.log('   New folders will be created with naming: "Player Name-UUID"');
console.log('   Old folders (UUID only) will be preserved\n');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  renameAthleteFolders().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 5000);

