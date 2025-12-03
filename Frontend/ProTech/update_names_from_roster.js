// Script to update names in Supabase database from roster file
// Normalizes all names to "First Last" format
// Run with: node update_names_from_roster.js

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
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

// Create Supabase client
// Note: If you get fetch errors, you may need to install node-fetch:
// npm install node-fetch
const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize name from "Last, First" to "First Last"
function normalizeToFirstLast(name) {
  if (!name) return null;
  
  const trimmed = name.trim();
  
  // If already in "First Last" format (no comma), return as is
  if (!trimmed.includes(',')) {
    return trimmed;
  }
  
  // If in "Last, First" format, convert to "First Last"
  const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
  if (parts.length >= 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  
  return trimmed;
}

// Normalize name for matching (case-insensitive, no commas, trimmed)
function normalizeForMatching(name) {
  if (!name) return "";
  return name.replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Match player name from roster to database entry
function matchName(rosterName, dbEntry) {
  const normalizedRoster = normalizeForMatching(rosterName);
  const normalizedDb = normalizeForMatching(dbEntry.name);
  
  // Exact match
  if (normalizedRoster === normalizedDb) {
    return true;
  }
  
  // Try matching by last name (handle "Last, First" vs "First Last")
  const rosterParts = normalizedRoster.split(' ');
  const dbParts = normalizedDb.split(' ');
  
  if (rosterParts.length >= 2 && dbParts.length >= 2) {
    const rosterLast = rosterParts[rosterParts.length - 1];
    const dbLast = dbParts[dbParts.length - 1];
    
    if (rosterLast === dbLast) {
      // Check if first names match (allowing for middle names)
      const rosterFirst = rosterParts[0];
      const dbFirst = dbParts[0];
      if (rosterFirst === dbFirst || 
          rosterFirst.startsWith(dbFirst) || 
          dbFirst.startsWith(rosterFirst)) {
        return true;
      }
    }
  }
  
  return false;
}

async function updateNamesFromRoster() {
  try {
    console.log('Reading roster file...');
    
    // Read the roster Excel file
    const rosterPath = path.join(__dirname, '../../2025 Roster.xlsx');
    if (!fs.existsSync(rosterPath)) {
      console.error('Error: Roster file not found at', rosterPath);
      process.exit(1);
    }
    
    const workbook = XLSX.readFile(rosterPath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    console.log(`Found ${jsonData.length} rows in roster\n`);
    
    // Extract all names from the roster
    const rosterNames = new Set();
    const nameColumn = 'UC Davis Football: Inseason 2025';
    const nameColumn2 = '__EMPTY_1';
    
    for (const row of jsonData) {
      // Skip header rows (position labels like "DL", "OL", etc.)
      const value1 = row[nameColumn];
      const value2 = row[nameColumn2];
      
      if (value1 && typeof value1 === 'string' && value1.includes(',')) {
        rosterNames.add(value1.trim());
      }
      if (value2 && typeof value2 === 'string' && value2.includes(',')) {
        rosterNames.add(value2.trim());
      }
    }
    
    console.log(`Found ${rosterNames.size} unique names in roster\n`);
    
    // Normalize roster names to "First Last" format
    const normalizedRosterNames = Array.from(rosterNames).map(name => ({
      original: name,
      normalized: normalizeToFirstLast(name)
    }));
    
    console.log('Sample normalized names:');
    normalizedRosterNames.slice(0, 5).forEach(({ original, normalized }) => {
      console.log(`  "${original}" -> "${normalized}"`);
    });
    console.log('');
    
    // Test connection first
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
    console.log('Supabase Key:', supabaseKey ? '✓ Set (first 20 chars: ' + supabaseKey.substring(0, 20) + '...)' : '✗ Missing');
    
    // Try a simple query to test connection
    const { data: testData, error: testError } = await supabase
      .from('names')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('\n❌ Connection test failed:', testError.message || testError);
      console.error('\n⚠️  Troubleshooting:');
      console.error('  1. Check your internet connection');
      console.error('  2. Verify Supabase URL is correct:', supabaseUrl);
      console.error('  3. Verify Supabase key is correct (check .env file)');
      console.error('  4. Check if Supabase project is active and accessible');
      
      if (testError.message?.includes('fetch failed') || testError.message?.includes('resolve')) {
        console.error('\n💡 Network/DNS Issue Detected:');
        console.error('  - This appears to be a DNS resolution or network connectivity problem');
        console.error('  - Try running: nslookup', supabaseUrl.replace('https://', '').replace('/rest/v1', ''));
        console.error('  - Check if you can access Supabase dashboard in your browser');
        console.error('  - Try from a different network (mobile hotspot, etc.)');
        console.error('  - Check firewall/proxy/VPN settings');
        console.error('  - If behind corporate firewall, contact IT about Supabase access');
      }
      
      console.error('\n📝 The script has successfully read the roster file.');
      console.error('   Once network connectivity is resolved, run the script again.');
      return;
    }
    
    console.log('✓ Connection successful!\n');
    
    // Fetch all names from database
    console.log('Fetching all names from database...');
    const { data: dbNames, error: fetchError } = await supabase
      .from('names')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching names:', fetchError);
      return;
    }
    
    if (!dbNames || dbNames.length === 0) {
      console.log('No names found in database');
      return;
    }
    
    console.log(`Found ${dbNames.length} entries in database\n`);
    
    // Match roster names to database entries
    const updates = [];
    const unmatchedRoster = [];
    const unmatchedDb = [];
    
    for (const { original, normalized } of normalizedRosterNames) {
      let matched = false;
      
      for (const dbEntry of dbNames) {
        if (matchName(original, dbEntry)) {
          // Check if update is needed
          const currentNormalized = normalizeToFirstLast(dbEntry.name);
          if (currentNormalized !== normalized) {
            updates.push({
              id: dbEntry.id,
              oldName: dbEntry.name,
              newName: normalized,
              position: dbEntry.position
            });
          }
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        unmatchedRoster.push({ original, normalized });
      }
    }
    
    // Find database entries that don't match any roster name
    for (const dbEntry of dbNames) {
      let matched = false;
      for (const { original } of normalizedRosterNames) {
        if (matchName(original, dbEntry)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        unmatchedDb.push(dbEntry);
      }
    }
    
    console.log('📊 Summary:');
    console.log(`  Roster names: ${normalizedRosterNames.length}`);
    console.log(`  Database entries: ${dbNames.length}`);
    console.log(`  Updates needed: ${updates.length}`);
    console.log(`  Unmatched roster names: ${unmatchedRoster.length}`);
    console.log(`  Unmatched database entries: ${unmatchedDb.length}\n`);
    
    if (unmatchedRoster.length > 0) {
      console.log('⚠️  Roster names not found in database:');
      unmatchedRoster.slice(0, 10).forEach(({ original, normalized }) => {
        console.log(`  "${original}" (normalized: "${normalized}")`);
      });
      if (unmatchedRoster.length > 10) {
        console.log(`  ... and ${unmatchedRoster.length - 10} more`);
      }
      console.log('');
    }
    
    if (unmatchedDb.length > 0) {
      console.log('⚠️  Database entries not found in roster:');
      unmatchedDb.slice(0, 10).forEach(entry => {
        console.log(`  ID: ${entry.id}, Name: "${entry.name}", Position: ${entry.position || 'N/A'}`);
      });
      if (unmatchedDb.length > 10) {
        console.log(`  ... and ${unmatchedDb.length - 10} more`);
      }
      console.log('');
    }
    
    if (updates.length === 0) {
      console.log('✅ All names are already normalized. No updates needed.');
      return;
    }
    
    console.log(`\n📝 Names to update (${updates.length}):`);
    updates.slice(0, 10).forEach(({ oldName, newName }) => {
      console.log(`  "${oldName}" -> "${newName}"`);
    });
    if (updates.length > 10) {
      console.log(`  ... and ${updates.length - 10} more`);
    }
    
    console.log('\n⚠️  WARNING: This will update names in the database.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update names in database
    console.log('Updating names in database...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const update of updates) {
      const { error } = await supabase
        .from('names')
        .update({ name: update.newName })
        .eq('id', update.id);
      
      if (error) {
        console.error(`Error updating ${update.oldName}:`, error);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Updated ${successCount}/${updates.length} names...`);
        }
      }
    }
    
    console.log(`\n✅ Successfully updated ${successCount} names.`);
    if (errorCount > 0) {
      console.log(`❌ Failed to update ${errorCount} names.`);
    }
    
    // Also update names in related tables
    console.log('\nUpdating names in related tables...');
    
    // Update ForcePlate_Baseline
    for (const update of updates) {
      await supabase
        .from('ForcePlate_Baseline')
        .update({ name: update.newName })
        .eq('id', update.id);
    }
    
    // Update ForcePlate_Weekly
    for (const update of updates) {
      await supabase
        .from('ForcePlate_Weekly')
        .update({ name: update.newName })
        .eq('id', update.id);
    }
    
    // Update NordBoard
    for (const update of updates) {
      await supabase
        .from('NordBoard')
        .update({ name: update.newName })
        .eq('id', update.id);
    }
    
    console.log('✅ Updated names in all related tables.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateNamesFromRoster();

