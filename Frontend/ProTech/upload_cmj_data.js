// Script to upload CMJ data from "Inseason 25 Nordbord and CMJ.xlsx" to ForcePlate_Baseline
// Extracts Name, Date, RSI-modified [m/s], Jump Height (Imp-Mom) [cm] from CMJ Inseason sheet
// Run with: node upload_cmj_data.js

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
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

// Convert Excel serial date to YYYY-MM-DD
function normalizeDate(excelDate) {
  if (typeof excelDate === 'number') {
    // Excel serial date (days since 1900-01-01)
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else if (typeof excelDate === 'string') {
    // Try to parse string date
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

async function uploadCMJData() {
  console.log('📊 Starting CMJ data upload process...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  const filePath = path.join(__dirname, '..', '..', 'Inseason 25 Nordbord and CMJ.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  const cmjSheet = workbook.Sheets['CMJ Inseason'];
  
  if (!cmjSheet) {
    console.error('❌ Error: "CMJ Inseason" sheet not found');
    console.error('Available sheets:', workbook.SheetNames);
    process.exit(1);
  }

  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(cmjSheet, { header: 1, defval: null });
  
  if (data.length < 2) {
    console.error('❌ Error: File has insufficient data');
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
    namesMap.set(normalized, { id: record.id, name: record.name });
  });

  console.log(`Loaded ${namesMap.size} names from names database\n`);

  // Parse data - each row can have multiple data points (weeks side by side)
  const dataPoints = [];
  const skipped = [];

  // Column pattern: Name (0), Date (1), RSI-modified (2), Jump Height (3), Eccentric (4), then repeats
  // Stop at column "DA" (index 104) - but we'll process until we find empty columns
  
  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row || row.length === 0) continue;

    // Process each set of columns (each week)
    for (let colStart = 0; colStart < row.length; colStart += 5) {
      // Check if we've reached column "DA" (index 104)
      if (colStart >= 104) break;

      const name = row[colStart];
      const dateValue = row[colStart + 1];
      const rsiModified = row[colStart + 2];
      const jumpHeight = row[colStart + 3];

      // Skip if name is missing or empty
      if (!name || typeof name !== 'string' || name.trim() === '') {
        continue;
      }

      // Skip if date is missing
      if (dateValue === null || dateValue === undefined) {
        continue;
      }

      // Convert name from "First Last" to "Last, First" and find in database
      const lastFirst = convertToLastFirst(name.trim());
      const normalized = normalizeName(lastFirst);
      const nameRecord = namesMap.get(normalized);

      if (!nameRecord) {
        skipped.push({
          name: name.trim(),
          attemptedMatch: lastFirst,
          date: dateValue,
          reason: 'Name not found in names database'
        });
        continue;
      }

      // Normalize date
      const normalizedDate = normalizeDate(dateValue);
      if (!normalizedDate) {
        skipped.push({
          name: name.trim(),
          date: dateValue,
          reason: 'Invalid date format'
        });
        continue;
      }

      // Skip if RSI or Jump Height are missing/null
      if ((rsiModified === null || rsiModified === undefined) && 
          (jumpHeight === null || jumpHeight === undefined)) {
        continue;
      }

      // Convert to numbers
      const rsiValue = rsiModified !== null && rsiModified !== undefined ? Number(rsiModified) : null;
      const jumpHeightValue = jumpHeight !== null && jumpHeight !== undefined ? Number(jumpHeight) : null;

      // Skip if both are NaN
      if ((rsiValue === null || isNaN(rsiValue)) && (jumpHeightValue === null || isNaN(jumpHeightValue))) {
        continue;
      }

      dataPoints.push({
        id: nameRecord.id,
        name: nameRecord.name,
        date: normalizedDate,
        rsi_modified_meters_sec: rsiValue !== null && !isNaN(rsiValue) ? rsiValue : null,
        jump_height_cm: jumpHeightValue !== null && !isNaN(jumpHeightValue) ? jumpHeightValue : null
      });
    }
  }

  console.log(`Found ${dataPoints.length} data points to upload`);
  console.log(`Skipped ${skipped.length} entries\n`);

  if (skipped.length > 0) {
    console.log('⚠️  ALL Skipped entries:');
    skipped.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.name} (${item.date}) - ${item.reason}`);
    });
    console.log('');
  }

  if (dataPoints.length === 0) {
    console.log('\n✅ No data points to upload.');
    return;
  }

  // First, deduplicate within the dataPoints array itself (same player+date might appear multiple times)
  console.log('\nDeduplicating data points...');
  const uniqueDataPoints = new Map();
  let duplicateInFile = 0;
  
  for (const point of dataPoints) {
    const key = `${point.id}-${point.date}`;
    if (uniqueDataPoints.has(key)) {
      duplicateInFile++;
      // If we have a duplicate, merge the data (take non-null values)
      const existing = uniqueDataPoints.get(key);
      if (point.rsi_modified_meters_sec !== null && existing.rsi_modified_meters_sec === null) {
        existing.rsi_modified_meters_sec = point.rsi_modified_meters_sec;
      }
      if (point.jump_height_cm !== null && existing.jump_height_cm === null) {
        existing.jump_height_cm = point.jump_height_cm;
      }
    } else {
      uniqueDataPoints.set(key, { ...point });
    }
  }
  
  if (duplicateInFile > 0) {
    console.log(`Found ${duplicateInFile} duplicate entries within the file (merged)`);
  }

  // Check for existing data in database
  console.log('Checking for existing data in database...');
  const toUpload = [];
  let duplicateCount = 0;

  for (const point of Array.from(uniqueDataPoints.values())) {
    // Check if entry exists for this player and date
    const { data: existing } = await supabase
      .from('ForcePlate_Baseline')
      .select('*')
      .eq('id', point.id)
      .eq('date', point.date)
      .maybeSingle();

    if (existing) {
      duplicateCount++;
      continue;
    }

    toUpload.push(point);
  }

  console.log(`Found ${duplicateCount} existing entries (will be skipped)`);
  console.log(`${toUpload.length} new entries to upload\n`);

  if (toUpload.length === 0) {
    console.log('✅ All data already exists in database.');
    return;
  }

  console.log('='.repeat(80));
  console.log('⚠️  WARNING: This will upload data to ForcePlate_Baseline table.');
  console.log(`   ${toUpload.length} new entries will be added.`);
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Upload in batches - use upsert to handle any remaining duplicates
  let successCount = 0;
  let errorCount = 0;
  const batchSize = 50;
  const errorDetails = [];

  for (let i = 0; i < toUpload.length; i += batchSize) {
    const batch = toUpload.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    // Prepare payload for each entry
    const payloads = batch.map(point => ({
      id: point.id,
      name: point.name,
      date: point.date,
      rsi_modified_meters_sec: point.rsi_modified_meters_sec,
      jump_height_cm: point.jump_height_cm,
      concentric_impulse_asym_percent_L: null,
      concentric_impulse_asym_percent_R: null,
      eccentric_deceleration_impulse_asym_percent_L: null,
      eccentric_deceleration_impulse_asym_percent_R: null,
      landing_impulse_asym_percent_L: null,
      landing_impulse_asym_percent_R: null
    }));

    try {
      // Use upsert to handle any edge case duplicates
      const { data, error } = await supabase
        .from('ForcePlate_Baseline')
        .upsert(payloads, { 
          onConflict: 'id,date',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ Error uploading batch ${batchNum}:`, error.message);
        console.error(`   Error details:`, JSON.stringify(error, null, 2));
        errorDetails.push({
          batch: batchNum,
          error: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          batchSize: batch.length,
          sampleEntries: batch.slice(0, 3).map(p => `${p.name} (${p.date})`)
        });
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ Uploaded batch ${batchNum} (${batch.length} entries)`);
      }
    } catch (err) {
      console.error(`❌ Exception uploading batch ${batchNum}:`, err.message);
      console.error(`   Stack:`, err.stack);
      errorDetails.push({
        batch: batchNum,
        error: err.message,
        errorType: err.constructor.name,
        batchSize: batch.length,
        sampleEntries: batch.slice(0, 3).map(p => `${p.name} (${p.date})`)
      });
      errorCount += batch.length;
    }

    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Upload complete!');
  console.log(`   Successfully uploaded: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Duplicates in file (merged): ${duplicateInFile}`);
  console.log(`   Duplicates in database (skipped): ${duplicateCount}`);
  console.log(`   Invalid entries skipped: ${skipped.length}`);
  
  if (errorDetails.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ ERROR DETAILS:');
    errorDetails.forEach((detail, i) => {
      console.log(`\n   Error ${i + 1} (Batch ${detail.batch}):`);
      console.log(`     Error: ${detail.error}`);
      if (detail.errorCode) console.log(`     Code: ${detail.errorCode}`);
      if (detail.errorDetails) console.log(`     Details: ${JSON.stringify(detail.errorDetails)}`);
      console.log(`     Batch size: ${detail.batchSize}`);
      console.log(`     Sample entries: ${detail.sampleEntries.join(', ')}`);
    });
  }
}

// Run the script
uploadCMJData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

