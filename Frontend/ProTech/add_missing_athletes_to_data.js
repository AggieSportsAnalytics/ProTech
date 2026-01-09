// Script to add missing athletes to athlete_data table
// Cross-references names table and roster.xlsx with athlete_data
// Adds players that are in names/roster but missing from athlete_data
// DOES NOT change any UUIDs
// Run with: node add_missing_athletes_to_data.js

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

// Normalize name for matching (case-insensitive, handle commas, trim)
function normalizeName(name) {
  if (!name) return '';
  return name.replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Convert "Last, First" to "First Last"
function normalizeToFirstLast(name) {
  if (!name) return null;
  
  const trimmed = String(name).trim();
  
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

// Match player name from roster to database entry
function matchName(rosterName, dbEntry) {
  const normalizedRoster = normalizeName(rosterName);
  const normalizedDb = normalizeName(dbEntry.name);
  
  // Exact match
  if (normalizedRoster === normalizedDb) {
    return true;
  }
  
  // Try matching by last name
  const rosterParts = normalizedRoster.split(' ');
  const dbParts = normalizedDb.split(' ');
  
  if (rosterParts.length >= 2 && dbParts.length >= 2) {
    const rosterLast = rosterParts[rosterParts.length - 1];
    const dbLast = dbParts[dbParts.length - 1];
    
    if (rosterLast === dbLast) {
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

async function addMissingAthletes() {
  console.log('🔍 Starting missing athletes check...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  try {
    // Step 1: Read roster file
    console.log('📊 Step 1: Reading roster file...');
    const rosterPath = path.join(__dirname, '../../2025 Roster.xlsx');
    if (!fs.existsSync(rosterPath)) {
      console.error('❌ Error: Roster file not found at', rosterPath);
      return;
    }
    
    const workbook = XLSX.readFile(rosterPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    // Extract names from roster
    const rosterNames = new Set();
    const nameColumn = 'UC Davis Football: Inseason 2025';
    const nameColumn2 = '__EMPTY_1';
    
    for (const row of jsonData) {
      const value1 = row[nameColumn];
      const value2 = row[nameColumn2];
      
      if (value1 && typeof value1 === 'string' && value1.includes(',')) {
        rosterNames.add(value1.trim());
      }
      if (value2 && typeof value2 === 'string' && value2.includes(',')) {
        rosterNames.add(value2.trim());
      }
    }
    
    // Normalize roster names to "First Last" format
    const normalizedRosterNames = Array.from(rosterNames).map(name => ({
      original: name,
      normalized: normalizeToFirstLast(name)
    }));
    
    console.log(`Found ${normalizedRosterNames.length} unique names in roster\n`);
    
    // Step 2: Get all names from names table
    console.log('📊 Step 2: Fetching names from names table...');
    const { data: allNames, error: namesError } = await supabase
      .from('names')
      .select('*');
    
    if (namesError) {
      console.error('❌ Error fetching names:', namesError);
      return;
    }
    
    if (!allNames || allNames.length === 0) {
      console.error('❌ No names found in names table');
      return;
    }
    
    console.log(`Found ${allNames.length} entries in names table\n`);
    
    // Step 3: Get all athletes from athlete_data table
    console.log('📊 Step 3: Fetching athletes from athlete_data table...');
    const { data: athleteData, error: athleteError } = await supabase
      .from('Athlete_Data')
      .select('id, name');
    
    if (athleteError) {
      console.error('❌ Error fetching athlete_data:', athleteError);
      return;
    }
    
    const athleteDataIds = new Set((athleteData || []).map(a => a.id.toLowerCase()));
    console.log(`Found ${athleteDataIds.size} entries in athlete_data table\n`);
    
    // Step 4: Find players in both names table and roster but NOT in athlete_data
    console.log('📊 Step 4: Finding missing athletes...');
    const missingAthletes = [];
    
    for (const { original, normalized } of normalizedRosterNames) {
      // Find matching entry in names table
      let matchedNameEntry = null;
      for (const nameEntry of allNames) {
        if (matchName(original, nameEntry)) {
          matchedNameEntry = nameEntry;
          break;
        }
      }
      
      // If found in names table, check if missing from athlete_data
      if (matchedNameEntry) {
        const isInAthleteData = athleteDataIds.has(matchedNameEntry.id.toLowerCase());
        
        if (!isInAthleteData) {
          missingAthletes.push({
            id: matchedNameEntry.id, // Use UUID from names table
            name: matchedNameEntry.name,
            position: matchedNameEntry.position || null,
            rosterName: original
          });
        }
      }
    }
    
    console.log(`Found ${missingAthletes.length} missing athletes\n`);
    
    if (missingAthletes.length === 0) {
      console.log('✅ All athletes from names table and roster are already in athlete_data.');
      return;
    }
    
    // Step 5: Display missing athletes
    console.log('='.repeat(80));
    console.log('📋 MISSING ATHLETES TO ADD');
    console.log('='.repeat(80));
    missingAthletes.forEach((athlete, i) => {
      console.log(`${String(i + 1).padStart(3)}. ${athlete.name} (Position: ${athlete.position || 'N/A'})`);
      console.log(`     UUID: ${athlete.id}`);
      console.log(`     Roster Name: ${athlete.rosterName}`);
    });
    console.log('='.repeat(80));
    
    // Step 6: Add missing athletes to athlete_data
    console.log('\n⚠️  WARNING: This will add new entries to the athlete_data table.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Adding missing athletes...\n');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < missingAthletes.length; i++) {
      const athlete = missingAthletes[i];
      
      try {
        // Create entry with empty stats array
        const { error } = await supabase
          .from('Athlete_Data')
          .insert({
            id: athlete.id, // Use UUID from names table - DO NOT CHANGE
            name: athlete.name,
            position: athlete.position,
            stats: [] // Empty stats array
          });
        
        if (error) {
          // Check if it's a duplicate key error (shouldn't happen, but just in case)
          if (error.code === '23505' || error.message.includes('duplicate')) {
            console.log(`[${i + 1}/${missingAthletes.length}] ⏭️  ${athlete.name} already exists, skipping`);
          } else {
            console.error(`[${i + 1}/${missingAthletes.length}] ❌ Error adding ${athlete.name}:`, error.message);
            errorCount++;
          }
        } else {
          console.log(`[${i + 1}/${missingAthletes.length}] ✅ Added: ${athlete.name} (UUID: ${athlete.id})`);
          successCount++;
        }
      } catch (error) {
        console.error(`[${i + 1}/${missingAthletes.length}] ❌ Error:`, error.message);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Process complete!');
    console.log(`   Successfully added: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total missing athletes found: ${missingAthletes.length}`);
    console.log('='.repeat(80));
    console.log('\n📝 Note: All UUIDs were preserved from the names table.');
    console.log('   No existing UUIDs were changed.');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
addMissingAthletes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



