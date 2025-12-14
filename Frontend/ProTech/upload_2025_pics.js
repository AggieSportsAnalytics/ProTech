// Script to upload images from 2025 Pics folder to Supabase storage
// Uploads images to player folders and renames them to 2025.jpg
// Run with: node upload_2025_pics.js

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

// Convert "firstLast" to "First Last" format
function convertFirstLastToFirstLast(filename) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg)$/i, '');
  
  // Find the boundary between first and last name (capital letter indicates start of last name)
  // Pattern: firstLast -> First Last
  const match = nameWithoutExt.match(/^([a-z]+)([A-Z][a-z]+)$/);
  if (match) {
    const first = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const last = match[2];
    return `${first} ${last}`;
  }
  
  // If pattern doesn't match, try to split on capital letters
  const parts = nameWithoutExt.split(/(?=[A-Z])/);
  if (parts.length >= 2) {
    const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const last = parts.slice(1).join(' ');
    return `${first} ${last}`;
  }
  
  return nameWithoutExt; // Return as-is if can't parse
}

// Convert "First Last" to "Last, First" format
function convertToLastFirst(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    return `${last}, ${first}`;
  }
  return name;
}

// Normalize name for matching (case-insensitive, trim whitespace)
function normalizeName(name) {
  return name.toLowerCase().trim();
}

// Sanitize folder name (remove invalid characters for file paths)
function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars with dash
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

async function upload2025Pics() {
  console.log('📸 Starting 2025 Pics upload process...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  const picsDir = path.join(__dirname, '..', '..', '2025 Pics');
  
  if (!fs.existsSync(picsDir)) {
    console.error(`❌ Error: Directory not found: ${picsDir}`);
    process.exit(1);
  }

  // Get all JPEG files from 2025 Pics directory
  const files = fs.readdirSync(picsDir)
    .filter(file => /\.(jpg|jpeg)$/i.test(file))
    .map(file => ({
      filename: file,
      path: path.join(picsDir, file)
    }));

  if (files.length === 0) {
    console.log('No JPEG files found in 2025 Pics directory');
    return;
  }

  console.log(`Found ${files.length} JPEG files in 2025 Pics directory\n`);

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
    namesMap.set(normalized, { id: record.id, name: record.name });
  });

  console.log(`Loaded ${namesMap.size} names from names database\n`);

  // Get all existing folders in storage
  const { data: items, error: listError } = await supabase.storage
    .from('athlete-images')
    .list('', {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (listError) {
    console.error('❌ Error listing storage folders:', listError.message);
    return;
  }

  // Filter to only folders
  const existingFolders = new Map();
  for (const item of items || []) {
    const { data: folderContents } = await supabase.storage
      .from('athlete-images')
      .list(item.name, { limit: 1 });
    
    if (folderContents !== null) {
      // Extract name from folder (if it's in "name-uuid" format)
      const parts = item.name.split('-');
      if (parts.length >= 5) {
        const potentialUUID = parts.slice(-5).join('-');
        const folderName = parts.slice(0, -5).join('-');
        existingFolders.set(normalizeName(folderName), item.name);
      }
    }
  }

  console.log(`Found ${existingFolders.size} existing folders in storage\n`);

  // Process each image
  const toUpload = [];
  const skipped = [];

  for (const file of files) {
    // Convert filename from "firstLast" to "First Last"
    const firstLast = convertFirstLastToFirstLast(file.filename);
    
    // Convert to "Last, First" format
    const lastFirst = convertToLastFirst(firstLast);
    const normalized = normalizeName(lastFirst);
    
    // Find in names database
    const nameRecord = namesMap.get(normalized);
    
    if (!nameRecord) {
      skipped.push({
        filename: file.filename,
        attemptedName: lastFirst,
        reason: 'Name not found in names database'
      });
      continue;
    }

    // Check if folder exists
    const normalizedDbName = normalizeName(nameRecord.name);
    let folderName = existingFolders.get(normalizedDbName);
    
    if (!folderName) {
      // Create new folder name
      const sanitizedName = sanitizeFolderName(nameRecord.name);
      folderName = `${sanitizedName}-${nameRecord.id}`;
    }

    toUpload.push({
      filename: file.filename,
      filePath: file.path,
      playerName: nameRecord.name,
      folderName: folderName,
      isNewFolder: !existingFolders.has(normalizedDbName)
    });
  }

  console.log('='.repeat(80));
  console.log(`Images to upload: ${toUpload.length}`);
  console.log(`Images to skip: ${skipped.length}`);
  console.log('='.repeat(80));

  if (skipped.length > 0) {
    console.log('\n⚠️  Skipped images (name not found in names database):');
    skipped.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.filename} (attempted match: "${item.attemptedName}")`);
    });
  }

  if (toUpload.length === 0) {
    console.log('\n✅ No images to upload.');
    return;
  }

  console.log('\nImages to upload:');
  toUpload.slice(0, 10).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.filename} → ${item.folderName}/2025.jpg${item.isNewFolder ? ' (new folder)' : ''}`);
  });
  if (toUpload.length > 10) {
    console.log(`  ... and ${toUpload.length - 10} more`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('⚠️  WARNING: This will upload images to Supabase storage.');
  console.log('   Existing 2025.jpg files will be overwritten.');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Upload images
  let successCount = 0;
  let errorCount = 0;
  const newFoldersCreated = [];

  for (let i = 0; i < toUpload.length; i++) {
    const item = toUpload[i];
    
    try {
      // Read the image file
      const imageBuffer = fs.readFileSync(item.filePath);

      // Upload to Supabase storage
      const uploadPath = `${item.folderName}/2025.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('athlete-images')
        .upload(uploadPath, imageBuffer, {
          cacheControl: '3600',
          upsert: true, // Overwrite if exists
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        console.log(`[${i + 1}/${toUpload.length}] ❌ Error uploading ${item.filename}: ${uploadError.message}`);
        errorCount++;
      } else {
        if (item.isNewFolder) {
          newFoldersCreated.push(item.folderName);
        }
        console.log(`[${i + 1}/${toUpload.length}] ✅ Uploaded ${item.filename} → ${uploadPath}${item.isNewFolder ? ' (new folder created)' : ''}`);
        successCount++;
      }

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.log(`[${i + 1}/${toUpload.length}] ❌ Error processing ${item.filename}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Upload complete!');
  console.log(`   Successfully uploaded: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Skipped: ${skipped.length}`);
  if (newFoldersCreated.length > 0) {
    console.log(`   New folders created: ${newFoldersCreated.length}`);
  }
  console.log(`\n📁 All images uploaded as 2025.jpg in respective player folders.`);
  
  if (skipped.length > 0) {
    console.log(`\n⚠️  ${skipped.length} images were skipped (names not found in database):`);
    skipped.forEach(item => {
      console.log(`   - ${item.filename}`);
    });
  }
}

// Run the script
upload2025Pics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

