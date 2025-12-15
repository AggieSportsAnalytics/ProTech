// Script to upload NordBoard data from "Inseason 25 Nordbord and CMJ.xlsx" to NordBoard table
// Extracts Name, Date, L Max Force (N), R Max Force (N), Max Imbalance (%) from NordBoard Inseason sheet
// Run with: node upload_nordboard_data.js

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

// Convert Excel column letter to index (A=0, B=1, ..., DC=106)
// Excel columns: A=1, B=2, ..., Z=26, AA=27, ..., DC=107 (1-indexed)
// Returns 0-based index: A=0, B=1, ..., Z=25, AA=26, ..., DC=106
function columnLetterToIndex(columnLetter) {
  let index = 0;
  for (let i = 0; i < columnLetter.length; i++) {
    index = index * 26 + (columnLetter.charCodeAt(i) - 64);
  }
  return index - 1; // Convert to 0-based index
}

async function uploadNordBoardData() {
  console.log('📊 Starting NordBoard data upload process...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  const filePath = path.join(__dirname, '..', '..', 'Inseason 25 Nordbord and CMJ.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  
  // Find NordBoard sheet - exact name is "Nordbord Inseason"
  const nordBoardSheet = workbook.Sheets['Nordbord Inseason'];
  
  if (!nordBoardSheet) {
    console.error('❌ Error: "Nordbord Inseason" sheet not found');
    console.error('Available sheets:', workbook.SheetNames);
    process.exit(1);
  }
  
  console.log('Found NordBoard sheet: Nordbord Inseason\n');

  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(nordBoardSheet, { header: 1, defval: null });
  
  if (data.length < 2) {
    console.error('❌ Error: File has insufficient data');
    return;
  }

  // Find header row (first row with "Name" or similar)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row.some(cell => cell && String(cell).toLowerCase().includes('name'))) {
      headerRowIdx = i;
      break;
    }
  }

  const headerRow = data[headerRowIdx];
  if (!headerRow) {
    console.error('❌ Error: Could not find header row');
    return;
  }

  // Find column indices for Name, Date, L Max Force, R Max Force, Max Imbalance
  // Pattern: Name (0), Date UTC (1), L Max Force (N) (2), R Max Force (N) (3), Max Imbalance (%) (4)
  // Pattern repeats every 5 columns starting from column A (index 0)
  // Stop at column DC (index 106, which contains "R AVG" - avg columns start after DC)
  const dcColumnIndex = columnLetterToIndex('DC'); // 106 (0-based)
  
  // The pattern is fixed: starts at column A (index 0), repeats every 5 columns
  const nameColIdx = 0;
  const dateColIdx = 1;
  const lMaxForceColIdx = 2;
  const rMaxForceColIdx = 3;
  const maxImbalanceColIdx = 4;
  const columnPattern = 5; // Pattern repeats every 5 columns
  
  // Verify the pattern matches the header
  const firstName = String(headerRow[nameColIdx] || '').toLowerCase();
  const firstDate = String(headerRow[dateColIdx] || '').toLowerCase();
  const firstL = String(headerRow[lMaxForceColIdx] || '').toLowerCase();
  const firstR = String(headerRow[rMaxForceColIdx] || '').toLowerCase();
  const firstImbalance = String(headerRow[maxImbalanceColIdx] || '').toLowerCase();
  
  if (!firstName.includes('name') || !firstDate.includes('date') ||
      !firstL.includes('l max force') || !firstR.includes('r max force') ||
      !firstImbalance.includes('max imbalance')) {
    console.error('❌ Error: Column pattern does not match expected structure');
    console.log('Expected: Name, Date UTC, L Max Force (N), R Max Force (N), Max Imbalance (%)');
    console.log('Found:', headerRow.slice(0, 5));
    return;
  }

  console.log(`Column pattern confirmed:`);
  console.log(`  Name: column A (${nameColIdx})`);
  console.log(`  Date UTC: column B (${dateColIdx})`);
  console.log(`  L Max Force (N): column C (${lMaxForceColIdx})`);
  console.log(`  R Max Force (N): column D (${rMaxForceColIdx})`);
  console.log(`  Max Imbalance (%): column E (${maxImbalanceColIdx})`);
  console.log(`  Pattern repeats every ${columnPattern} columns`);
  console.log(`  Stopping at column DC (index ${dcColumnIndex}) - avg columns start after DC\n`);

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

  // Process each data row (skip header row)
  for (let rowIdx = headerRowIdx + 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row || row.length === 0) continue;

    // Process each set of columns (each week)
    // Start from column A (index 0), then process every 5 columns
    for (let patternStart = 0; patternStart < row.length; patternStart += columnPattern) {
      // Stop at column DC (index 106) - don't process DC or beyond (avg columns start at DC)
      if (patternStart >= dcColumnIndex) break;

      // Skip if name is empty (empty pattern block)
      const name = row[patternStart];
      if (!name || typeof name !== 'string' || name.trim() === '') {
        continue;
      }

      // Calculate relative positions within the pattern (offsets from patternStart)
      const dateValue = row[patternStart + dateColIdx];
      const lMaxForce = row[patternStart + lMaxForceColIdx];
      const rMaxForce = row[patternStart + rMaxForceColIdx];
      const maxImbalance = row[patternStart + maxImbalanceColIdx];

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

      // Skip if all three metrics are missing/null
      if ((lMaxForce === null || lMaxForce === undefined) && 
          (rMaxForce === null || rMaxForce === undefined) &&
          (maxImbalance === null || maxImbalance === undefined)) {
        continue;
      }

      // Convert to numbers
      const lMaxForceValue = lMaxForce !== null && lMaxForce !== undefined ? Number(lMaxForce) : null;
      const rMaxForceValue = rMaxForce !== null && rMaxForce !== undefined ? Number(rMaxForce) : null;
      const maxImbalanceValue = maxImbalance !== null && maxImbalance !== undefined ? Number(maxImbalance) : null;

      // Skip if all are NaN
      if ((lMaxForceValue === null || isNaN(lMaxForceValue)) && 
          (rMaxForceValue === null || isNaN(rMaxForceValue)) &&
          (maxImbalanceValue === null || isNaN(maxImbalanceValue))) {
        continue;
      }

      dataPoints.push({
        id: nameRecord.id,
        name: nameRecord.name,
        date: normalizedDate,
        L_max_force_n: lMaxForceValue !== null && !isNaN(lMaxForceValue) ? lMaxForceValue : null,
        R_max_force_n: rMaxForceValue !== null && !isNaN(rMaxForceValue) ? rMaxForceValue : null,
        max_imbalance_percent: maxImbalanceValue !== null && !isNaN(maxImbalanceValue) ? maxImbalanceValue : null
      });
    }
  }

  console.log(`Found ${dataPoints.length} data points to upload`);
  console.log(`Skipped ${skipped.length} entries\n`);

  if (skipped.length > 0 && skipped.length <= 50) {
    console.log('⚠️  Skipped entries (showing first 50):');
    skipped.slice(0, 50).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.name} (${item.date}) - ${item.reason}`);
    });
    console.log('');
  } else if (skipped.length > 50) {
    console.log(`⚠️  Skipped ${skipped.length} entries (too many to display)\n`);
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
      if (point.L_max_force_n !== null && existing.L_max_force_n === null) {
        existing.L_max_force_n = point.L_max_force_n;
      }
      if (point.R_max_force_n !== null && existing.R_max_force_n === null) {
        existing.R_max_force_n = point.R_max_force_n;
      }
      if (point.max_imbalance_percent !== null && existing.max_imbalance_percent === null) {
        existing.max_imbalance_percent = point.max_imbalance_percent;
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
      .from('NordBoard')
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
  console.log('⚠️  WARNING: This will upload data to NordBoard table.');
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
      L_max_force_n: point.L_max_force_n,
      R_max_force_n: point.R_max_force_n,
      max_imbalance_percent: point.max_imbalance_percent
    }));

    try {
      // Use upsert to handle any edge case duplicates
      const { data, error } = await supabase
        .from('NordBoard')
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
uploadNordBoardData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
