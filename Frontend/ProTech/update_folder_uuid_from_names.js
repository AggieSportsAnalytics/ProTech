// Script to update folder names from names_backup UUID to names database UUID
// Updates folders in "name-uuid" format to use UUID from names database
// Run with: node update_folder_uuid_from_names.js

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

// Sanitize folder name (remove invalid characters for file paths)
function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars with dash
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Extract name and UUID from folder name in "name-uuid" format
function extractNameAndUUID(folderName) {
  // Format: "Player Name-UUID" where UUID is at the end
  const parts = folderName.split('-');
  if (parts.length < 5) {
    return null; // Not enough parts for a UUID
  }
  
  // Last 5 parts should be the UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const potentialUUID = parts.slice(-5).join('-');
  if (!isUUID(potentialUUID)) {
    return null; // Not a valid UUID format
  }
  
  // Everything before the UUID is the name
  const name = parts.slice(0, -5).join('-');
  return { name: name.trim(), uuid: potentialUUID };
}

// Normalize name for matching (case-insensitive, trim whitespace)
function normalizeName(name) {
  return name.toLowerCase().trim();
}

// Convert "First Last" to "Last, First" format
function convertToLastFirst(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    return `${last}, ${first}`;
  }
  return name; // Return as-is if can't parse
}

// Try to match name in both formats
function findNameInDatabase(extractedName, namesMap) {
  const normalized = normalizeName(extractedName);
  
  // Try direct match first
  let match = namesMap.get(normalized);
  if (match) return match;
  
  // Try converting "First Last" to "Last, First"
  const lastFirst = convertToLastFirst(extractedName);
  const normalizedLastFirst = normalizeName(lastFirst);
  match = namesMap.get(normalizedLastFirst);
  if (match) return match;
  
  // Try reverse: if database has "Last, First", try "First Last"
  for (const [dbName, record] of namesMap.entries()) {
    if (dbName.includes(',')) {
      // Database name is "Last, First" format
      const parts = dbName.split(',');
      if (parts.length === 2) {
        const dbFirstLast = normalizeName(`${parts[1].trim()} ${parts[0].trim()}`);
        if (dbFirstLast === normalized) {
          return record;
        }
      }
    }
  }
  
  return null;
}

async function updateFolderUUIDs() {
  console.log('🔄 Starting folder UUID update process...\n');
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

    // Filter to only "name-uuid" format folders (ignore pure UUID folders)
    const nameUUIDFolders = [];
    const uuidOnlyFolders = [];

    for (const folder of folders) {
      if (isUUID(folder)) {
        // Pure UUID folder - ignore
        uuidOnlyFolders.push(folder);
      } else {
        // Might be "name-uuid" format
        const extracted = extractNameAndUUID(folder);
        if (extracted) {
          nameUUIDFolders.push({
            oldFolderName: folder,
            extractedName: extracted.name,
            oldUUID: extracted.uuid
          });
        }
      }
    }

    console.log(`UUID-only folders (ignored): ${uuidOnlyFolders.length}`);
    console.log(`Name-UUID format folders: ${nameUUIDFolders.length}\n`);

    if (nameUUIDFolders.length === 0) {
      console.log('No folders in "name-uuid" format found');
      return;
    }

    // Load all names from names database
    const { data: allNames, error: namesError } = await supabase
      .from('names')
      .select('id, name');

    if (namesError) {
      console.error('❌ Error loading names database:', namesError.message);
      return;
    }

    if (!allNames || allNames.length === 0) {
      console.error('❌ No records found in names database');
      return;
    }

    // Create lookup map: normalized name -> { id, name }
    const namesMap = new Map();
    allNames.forEach(record => {
      const normalized = normalizeName(record.name);
      // Store both the original name and UUID
      namesMap.set(normalized, { id: record.id, name: record.name });
    });

    console.log(`Loaded ${namesMap.size} names from names database\n`);

    // Process each folder
    const toUpdate = [];
    const toSkip = [];

    for (const folder of nameUUIDFolders) {
      // Try to find the name in database (handles both "First Last" and "Last, First" formats)
      const nameRecord = findNameInDatabase(folder.extractedName, namesMap);

      if (!nameRecord) {
        // Name not found in names database - skip
        toSkip.push({ ...folder, reason: 'Name not found in names database' });
        continue;
      }

      // Check if UUID is already correct
      if (nameRecord.id.toLowerCase() === folder.oldUUID.toLowerCase()) {
        // UUID already matches - no update needed
        toSkip.push({ ...folder, reason: 'UUID already matches' });
        continue;
      }

      // Need to update - create new folder name with UUID from names database
      const sanitizedName = sanitizeFolderName(nameRecord.name);
      const newFolderName = `${sanitizedName}-${nameRecord.id}`;

      toUpdate.push({
        ...folder,
        newFolderName: newFolderName,
        newUUID: nameRecord.id,
        playerName: nameRecord.name
      });
    }

    console.log('='.repeat(80));
    console.log(`Folders to update: ${toUpdate.length}`);
    console.log(`Folders to skip: ${toSkip.length}`);
    console.log('='.repeat(80));

    if (toUpdate.length === 0) {
      console.log('\n✅ No folders need updating. All folders already use UUIDs from names database.');
      return;
    }

    // Show what will be updated
    console.log('\nFolders to be updated:');
    toUpdate.slice(0, 10).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.oldFolderName}`);
      console.log(`     → ${item.newFolderName}`);
    });
    if (toUpdate.length > 10) {
      console.log(`  ... and ${toUpdate.length - 10} more`);
    }

    if (toSkip.length > 0) {
      console.log('\nFolders to skip:');
      const notFound = toSkip.filter(f => !f.reason);
      const alreadyMatch = toSkip.filter(f => f.reason === 'UUID already matches');
      
      if (notFound.length > 0) {
        console.log(`  Not found in names database: ${notFound.length}`);
        notFound.slice(0, 5).forEach((item, i) => {
          console.log(`    ${i + 1}. ${item.oldFolderName} (extracted name: "${item.extractedName}")`);
        });
        if (notFound.length > 5) {
          console.log(`    ... and ${notFound.length - 5} more`);
        }
      }
      if (alreadyMatch.length > 0) {
        console.log(`  UUID already matches: ${alreadyMatch.length}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('⚠️  WARNING: This will create new folders with updated UUIDs.');
    console.log('   Old "name-uuid" folders will be DELETED after successful copy.');
    console.log('   UUID-only folders will NOT be deleted.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update folders
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toUpdate.length; i++) {
      const item = toUpdate[i];
      
      try {
        // Check if new folder already exists
        const { data: existingFolder } = await supabase.storage
          .from('athlete-images')
          .list(item.newFolderName, { limit: 1 });

        if (existingFolder && existingFolder.length > 0) {
          console.log(`[${i + 1}/${toUpdate.length}] ⏭️  ${item.newFolderName} already exists, skipping`);
          continue;
        }

        // List all files in the old folder
        const { data: files, error: filesError } = await supabase.storage
          .from('athlete-images')
          .list(item.oldFolderName, { limit: 1000 });

        if (filesError) {
          console.log(`[${i + 1}/${toUpdate.length}] ❌ Error listing files in ${item.oldFolderName}: ${filesError.message}`);
          errorCount++;
          continue;
        }

        if (!files || files.length === 0) {
          console.log(`[${i + 1}/${toUpdate.length}] ⚠️  No files in ${item.oldFolderName}, skipping`);
          continue;
        }

        console.log(`[${i + 1}/${toUpdate.length}] 📁 Updating: ${item.oldFolderName} → ${item.newFolderName} (${files.length} files)`);

        // Copy each file to the new folder
        let filesCopied = 0;
        for (const file of files) {
          const oldPath = `${item.oldFolderName}/${file.name}`;
          const newPath = `${item.newFolderName}/${file.name}`;

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
          // All files copied successfully, now delete the old folder
          const filesToDelete = files.map(file => `${item.oldFolderName}/${file.name}`);
          const { error: deleteError } = await supabase.storage
            .from('athlete-images')
            .remove(filesToDelete);

          if (deleteError) {
            console.log(`   ⚠️  Error deleting old folder: ${deleteError.message}`);
            console.log(`   ✅ New folder created (${filesCopied} files), but old folder preserved due to deletion error`);
            errorCount++;
          } else {
            console.log(`   ✅ Successfully updated folder (${filesCopied} files copied, old folder deleted)`);
            successCount++;
          }
        } else {
          console.log(`   ⚠️  Only ${filesCopied}/${files.length} files copied - old folder preserved`);
          errorCount++;
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.log(`[${i + 1}/${toUpdate.length}] ❌ Error processing ${item.oldFolderName}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Update complete!');
    console.log(`   Successfully updated: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Skipped: ${toSkip.length}`);
    console.log(`\n📁 New folders created with UUIDs from names database.`);
    console.log(`   Old "name-uuid" folders have been deleted after successful copy.`);
    console.log(`   UUID-only folders were not touched.`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
updateFolderUUIDs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

