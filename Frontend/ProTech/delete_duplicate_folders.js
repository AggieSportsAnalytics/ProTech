// Script to delete old UUID-only folders that have duplicates (Player Name-UUID folders)
// Only deletes folders if a corresponding "Player Name-UUID" folder exists
// Run with: node delete_duplicate_folders.js

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

// Check if a string is a UUID (basic pattern check)
function isUUID(str) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

async function deleteDuplicateFolders() {
  console.log('🗑️  Starting duplicate folder deletion process...\n');
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

    console.log(`Found ${folders.length} folders\n`);

    // Separate UUID-only folders from "Player Name-UUID" folders
    const uuidOnlyFolders = [];
    const namedFolders = new Map(); // Map UUID -> folder name

    for (const folder of folders) {
      if (isUUID(folder)) {
        // This is a UUID-only folder
        uuidOnlyFolders.push(folder);
      } else {
        // This might be a "Player Name-UUID" folder
        // Extract UUID from the end (format: "Name-UUID")
        const parts = folder.split('-');
        if (parts.length >= 5) {
          // Last 5 parts should be the UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
          const potentialUUID = parts.slice(-5).join('-');
          if (isUUID(potentialUUID)) {
            namedFolders.set(potentialUUID.toLowerCase(), folder);
          }
        }
      }
    }

    console.log(`UUID-only folders: ${uuidOnlyFolders.length}`);
    console.log(`Named folders (Player Name-UUID): ${namedFolders.size}\n`);

    // Find duplicates: UUID-only folders that have a corresponding named folder
    const duplicates = [];
    const noDuplicates = [];

    for (const uuidFolder of uuidOnlyFolders) {
      const uuidLower = uuidFolder.toLowerCase();
      if (namedFolders.has(uuidLower)) {
        duplicates.push({
          oldFolder: uuidFolder,
          newFolder: namedFolders.get(uuidLower)
        });
      } else {
        noDuplicates.push(uuidFolder);
      }
    }

    console.log('='.repeat(80));
    console.log(`Found ${duplicates.length} duplicate folders to delete`);
    console.log(`Found ${noDuplicates.length} UUID-only folders with NO duplicate (will be kept)\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate folders found. Nothing to delete.');
      return;
    }

    // Show what will be deleted
    console.log('Folders to be deleted (old UUID-only folders):');
    duplicates.slice(0, 10).forEach((dup, i) => {
      console.log(`  ${i + 1}. ${dup.oldFolder} → (has duplicate: ${dup.newFolder})`);
    });
    if (duplicates.length > 10) {
      console.log(`  ... and ${duplicates.length - 10} more`);
    }

    if (noDuplicates.length > 0) {
      console.log('\nFolders that will be KEPT (no duplicate found):');
      noDuplicates.slice(0, 10).forEach((folder, i) => {
        console.log(`  ${i + 1}. ${folder}`);
      });
      if (noDuplicates.length > 10) {
        console.log(`  ... and ${noDuplicates.length - 10} more`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('⚠️  WARNING: This will delete the old UUID-only folders listed above.');
    console.log('   Only folders with duplicates will be deleted.');
    console.log('   Folders without duplicates will be preserved.\n');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete duplicate folders
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < duplicates.length; i++) {
      const { oldFolder, newFolder } = duplicates[i];
      
      try {
        // List all files in the old folder
        const { data: files, error: filesError } = await supabase.storage
          .from('athlete-images')
          .list(oldFolder, { limit: 1000 });

        if (filesError) {
          console.log(`[${i + 1}/${duplicates.length}] ⚠️  Error listing files in ${oldFolder}: ${filesError.message}`);
          errorCount++;
          continue;
        }

        if (!files || files.length === 0) {
          console.log(`[${i + 1}/${duplicates.length}] ⚠️  No files in ${oldFolder}, skipping`);
          continue;
        }

        // Delete all files in the folder
        const filesToDelete = files.map(file => `${oldFolder}/${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from('athlete-images')
          .remove(filesToDelete);

        if (deleteError) {
          console.log(`[${i + 1}/${duplicates.length}] ❌ Error deleting ${oldFolder}: ${deleteError.message}`);
          errorCount++;
        } else {
          console.log(`[${i + 1}/${duplicates.length}] ✅ Deleted ${oldFolder} (${files.length} files) → duplicate: ${newFolder}`);
          successCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`[${i + 1}/${duplicates.length}] ❌ Error processing ${oldFolder}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Deletion complete!');
    console.log(`   Successfully deleted: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Kept (no duplicate): ${noDuplicates.length}`);
    console.log(`\n📁 Old UUID-only folders with duplicates have been removed.`);
    console.log(`   Folders without duplicates have been preserved.`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
deleteDuplicateFolders().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

