// Script to fix data mixup where some player names were turned into numbers
// Preserves valid names with their UUIDs, matches missing players to storage folders,
// and restores them to correct UUIDs or assigns to messed up spots
// Run with: node fix_names_data_mixup.js

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

// Check if a string is a number (or looks like a number)
function isNumber(str) {
  if (!str || typeof str !== 'string') return false;
  // Check if it's a pure number (integer or decimal)
  return /^\d+(\.\d+)?$/.test(str.trim());
}

// Check if a string is a UUID
function isUUID(str) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

// Normalize name for matching (case-insensitive, trim, handle commas)
function normalizeName(name) {
  if (!name) return '';
  return name.replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Convert "Last, First" to "First Last"
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

// Extract name and UUID from folder name in "name-uuid" format
function extractNameAndUUID(folderName) {
  const parts = folderName.split('-');
  if (parts.length < 5) {
    return null;
  }
  
  // Last 5 parts should be the UUID
  const potentialUUID = parts.slice(-5).join('-');
  if (!isUUID(potentialUUID)) {
    return null;
  }
  
  // Everything before the UUID is the name
  const name = parts.slice(0, -5).join('-');
  return { name: name.trim(), uuid: potentialUUID };
}

// Match name from roster to database entry
function matchName(rosterName, dbName) {
  const normalizedRoster = normalizeName(rosterName);
  const normalizedDb = normalizeName(dbName);
  
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

async function fixNamesDataMixup() {
  console.log('🔧 Starting data mixup fix process...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  try {
    // Step 1: Get all names from database
    console.log('📊 Step 1: Fetching all names from database...');
    const { data: allNames, error: fetchError } = await supabase
      .from('names')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching names:', fetchError);
      return;
    }
    
    if (!allNames || allNames.length === 0) {
      console.error('❌ No names found in database');
      return;
    }
    
    console.log(`Found ${allNames.length} entries in database\n`);
    
    // Step 2: Separate valid names from number-corrupted names
    console.log('📊 Step 2: Separating valid names from corrupted (number) names...');
    const validNames = [];
    const corruptedEntries = []; // Entries with number names
    
    for (const entry of allNames) {
      if (isNumber(entry.name)) {
        corruptedEntries.push(entry);
      } else {
        validNames.push(entry);
      }
    }
    
    console.log(`✅ Valid names: ${validNames.length}`);
    console.log(`❌ Corrupted (number) names: ${corruptedEntries.length}\n`);
    
    // Step 3: Read roster file
    console.log('📊 Step 3: Reading 2025 Roster.xlsx...');
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
    
    // Step 4: Find missing players (in roster but not in valid names)
    console.log('📊 Step 4: Finding missing players...');
    const missingPlayers = [];
    
    for (const { original, normalized } of normalizedRosterNames) {
      let found = false;
      for (const validEntry of validNames) {
        if (matchName(original, validEntry.name)) {
          found = true;
          break;
        }
      }
      if (!found) {
        missingPlayers.push({ original, normalized });
      }
    }
    
    console.log(`Missing players: ${missingPlayers.length}\n`);
    
    // Step 5: List all folders in storage bucket
    console.log('📊 Step 5: Listing folders in storage bucket...');
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
    
    // Filter to only folders
    const folders = [];
    for (const item of items || []) {
      const { data: folderContents } = await supabase.storage
        .from('athlete-images')
        .list(item.name, { limit: 1 });
      
      if (folderContents !== null) {
        folders.push(item.name);
      }
    }
    
    console.log(`Found ${folders.length} folders in storage bucket\n`);
    
    // Step 6: Try to match missing players to folders
    console.log('📊 Step 6: Matching missing players to storage folders...');
    const matchedPlayers = []; // { player, folderName, uuid }
    const unmatchedPlayers = [];
    
    // Create a map of folder names to UUIDs
    const folderMap = new Map(); // normalized name -> { folderName, uuid }
    
    for (const folder of folders) {
      const extracted = extractNameAndUUID(folder);
      if (extracted) {
        const normalized = normalizeName(extracted.name);
        folderMap.set(normalized, {
          folderName: folder,
          uuid: extracted.uuid,
          name: extracted.name
        });
      }
    }
    
    // Try to match missing players to folders
    for (const player of missingPlayers) {
      const normalized = normalizeName(player.normalized);
      let matched = false;
      
      // Try exact match
      if (folderMap.has(normalized)) {
        const folderInfo = folderMap.get(normalized);
        matchedPlayers.push({
          player: player,
          folderName: folderInfo.folderName,
          uuid: folderInfo.uuid,
          matchedBy: 'exact'
        });
        matched = true;
      } else {
        // Try fuzzy matching
        for (const [folderName, folderInfo] of folderMap.entries()) {
          if (matchName(player.normalized, folderInfo.name)) {
            matchedPlayers.push({
              player: player,
              folderName: folderInfo.folderName,
              uuid: folderInfo.uuid,
              matchedBy: 'fuzzy'
            });
            matched = true;
            break;
          }
        }
      }
      
      if (!matched) {
        unmatchedPlayers.push(player);
      }
    }
    
    console.log(`✅ Matched to folders: ${matchedPlayers.length}`);
    console.log(`❌ Unmatched: ${unmatchedPlayers.length}\n`);
    
    // Step 7: Prepare updates
    console.log('📊 Step 7: Preparing updates...');
    const updates = [];
    const assignments = []; // Players assigned to corrupted spots
    
    // First, restore matched players to their correct UUIDs
    for (const match of matchedPlayers) {
      // Find a corrupted entry to update (or create new if needed)
      const corruptedEntry = corruptedEntries.find(e => 
        e.id.toLowerCase() === match.uuid.toLowerCase()
      );
      
      if (corruptedEntry) {
        // Update existing corrupted entry
        updates.push({
          id: corruptedEntry.id,
          oldName: corruptedEntry.name,
          newName: match.player.normalized,
          source: 'folder_match',
          folderName: match.folderName
        });
      } else {
        // Check if UUID already exists with valid name
        const existingValid = validNames.find(v => v.id.toLowerCase() === match.uuid.toLowerCase());
        if (!existingValid) {
          // Need to insert new entry
          updates.push({
            id: match.uuid,
            oldName: null,
            newName: match.player.normalized,
            source: 'folder_match_new',
            folderName: match.folderName,
            isInsert: true
          });
        }
      }
    }
    
    // Then, assign unmatched players to corrupted spots
    let corruptedIndex = 0;
    for (const player of unmatchedPlayers) {
      if (corruptedIndex < corruptedEntries.length) {
        const corruptedEntry = corruptedEntries[corruptedIndex];
        updates.push({
          id: corruptedEntry.id,
          oldName: corruptedEntry.name,
          newName: player.normalized,
          source: 'random_assignment',
          folderName: null
        });
        assignments.push({
          player: player,
          uuid: corruptedEntry.id,
          note: '⚠️  MANUAL FIX NEEDED: Images may need to be moved to match this UUID'
        });
        corruptedIndex++;
      }
    }
    
    console.log(`Updates to apply: ${updates.length}`);
    console.log(`  - Folder matches: ${matchedPlayers.length}`);
    console.log(`  - Random assignments: ${assignments.length}\n`);
    
    // Step 8: Show summary
    console.log('='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Valid names preserved: ${validNames.length}`);
    console.log(`Corrupted entries found: ${corruptedEntries.length}`);
    console.log(`Missing players from roster: ${missingPlayers.length}`);
    console.log(`  - Matched to folders: ${matchedPlayers.length}`);
    console.log(`  - Unmatched (random assignment): ${unmatchedPlayers.length}`);
    console.log(`Total updates: ${updates.length}\n`);
    
    if (matchedPlayers.length > 0) {
      console.log('✅ Players matched to folders:');
      matchedPlayers.slice(0, 10).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.player.normalized} → UUID: ${match.uuid}`);
      });
      if (matchedPlayers.length > 10) {
        console.log(`  ... and ${matchedPlayers.length - 10} more`);
      }
      console.log('');
    }
    
    if (assignments.length > 0) {
      console.log('⚠️  Players assigned randomly (MANUAL FIX NEEDED):');
      assignments.forEach((assignment, i) => {
        console.log(`  ${i + 1}. ${assignment.player.normalized} → UUID: ${assignment.uuid}`);
      });
      console.log('');
    }
    
    // Step 9: Apply updates
    if (updates.length === 0) {
      console.log('✅ No updates needed. All data is correct.');
      return;
    }
    
    console.log('='.repeat(80));
    console.log('⚠️  WARNING: This will update the names table in the database.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Applying updates...\n');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      
      try {
        if (update.isInsert) {
          // Insert new entry
          const { error } = await supabase
            .from('names')
            .insert({
              id: update.id,
              name: update.newName,
              position: null // Will need to be updated manually
            });
          
          if (error) {
            console.error(`[${i + 1}/${updates.length}] ❌ Error inserting ${update.newName}:`, error.message);
            errorCount++;
          } else {
            console.log(`[${i + 1}/${updates.length}] ✅ Inserted: ${update.newName} (UUID: ${update.id})`);
            successCount++;
          }
        } else {
          // Update existing entry
          const { error } = await supabase
            .from('names')
            .update({ name: update.newName })
            .eq('id', update.id);
          
          if (error) {
            console.error(`[${i + 1}/${updates.length}] ❌ Error updating ${update.oldName}:`, error.message);
            errorCount++;
          } else {
            console.log(`[${i + 1}/${updates.length}] ✅ Updated: "${update.oldName}" → "${update.newName}" (UUID: ${update.id})`);
            successCount++;
          }
        }
      } catch (error) {
        console.error(`[${i + 1}/${updates.length}] ❌ Error:`, error.message);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Update complete!');
    console.log(`   Successfully updated: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('='.repeat(80));
    
    // Step 10: Log assignments that need manual fixing
    if (assignments.length > 0) {
      console.log('\n⚠️  MANUAL FIX REQUIRED - Players assigned randomly:');
      console.log('='.repeat(80));
      const logPath = path.join(__dirname, 'manual_fix_required.log');
      let logContent = 'Players assigned randomly - Images may need to be moved:\n';
      logContent += '='.repeat(80) + '\n\n';
      
      assignments.forEach((assignment, i) => {
        const logLine = `${i + 1}. Player: ${assignment.player.normalized}\n   UUID: ${assignment.uuid}\n   Note: ${assignment.note}\n\n`;
        console.log(logLine);
        logContent += logLine;
      });
      
      fs.writeFileSync(logPath, logContent);
      console.log(`\n📝 Full log saved to: ${logPath}`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
fixNamesDataMixup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




