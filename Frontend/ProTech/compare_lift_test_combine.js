// Script to compare player data between "Inseason 25 Nordbord and CMJ.xlsx" (lift testing)
// and "2025 Aggie Combine.xlsx" (combine data)
// Does NOT modify database - read-only comparison
// Run with: node compare_lift_test_combine.js

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Normalize name for matching (case-insensitive, handle commas, trim)
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
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

// Extract player names from NordBoard sheet
function extractNordBoardPlayers(filePath) {
  const workbook = XLSX.readFile(filePath);
  const nordBoardSheet = workbook.Sheets['Nordbord Inseason'];
  
  if (!nordBoardSheet) {
    console.error('❌ Error: "Nordbord Inseason" sheet not found');
    console.error('Available sheets:', workbook.SheetNames);
    return new Set();
  }
  
  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(nordBoardSheet, { header: 1, defval: null });
  
  const players = new Set();
  
  // Find header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row.some(cell => cell && String(cell).toLowerCase().includes('name'))) {
      headerRowIdx = i;
      break;
    }
  }
  
  // Extract names from first column (Name column)
  // Pattern: Name is in column A (index 0), repeats every 5 columns
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (row && row[0]) {
      const name = String(row[0]).trim();
      if (name && name.length > 0 && !name.toLowerCase().includes('name')) {
        const normalized = normalizeToFirstLast(name);
        if (normalized) {
          players.add(normalized);
        }
      }
    }
  }
  
  return players;
}

// Extract player names from CMJ sheet
function extractCMJPlayers(filePath) {
  const workbook = XLSX.readFile(filePath);
  const cmjSheet = workbook.Sheets['CMJ Inseason'];
  
  if (!cmjSheet) {
    return new Set();
  }
  
  // Convert to JSON format
  const jsonData = XLSX.utils.sheet_to_json(cmjSheet, { defval: null });
  
  const players = new Set();
  
  for (const row of jsonData) {
    const name = row['Name'] || row['name'];
    if (name) {
      const normalized = normalizeToFirstLast(String(name));
      if (normalized) {
        players.add(normalized);
      }
    }
  }
  
  return players;
}

// Extract player names from Combine file
function extractCombinePlayers(filePath) {
  const workbook = XLSX.readFile(filePath);
  
  // Try to find the main data sheet (usually first sheet or one with data)
  let mainSheet = null;
  let mainSheetName = null;
  
  // Look for common sheet names
  const possibleSheetNames = workbook.SheetNames.filter(name => 
    !name.toLowerCase().includes('summary') && 
    !name.toLowerCase().includes('notes') &&
    !name.toLowerCase().includes('info')
  );
  
  if (possibleSheetNames.length > 0) {
    mainSheetName = possibleSheetNames[0];
    mainSheet = workbook.Sheets[mainSheetName];
  } else if (workbook.SheetNames.length > 0) {
    mainSheetName = workbook.SheetNames[0];
    mainSheet = workbook.Sheets[mainSheetName];
  }
  
  if (!mainSheet) {
    console.error('❌ Error: Could not find data sheet in combine file');
    console.error('Available sheets:', workbook.SheetNames);
    return new Set();
  }
  
  console.log(`Using sheet: "${mainSheetName}" from combine file`);
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(mainSheet, { defval: null });
  
  const players = new Set();
  
  // Try to find name column (could be "Name", "Player", "Athlete", etc.)
  const nameColumns = Object.keys(jsonData[0] || {}).filter(key => 
    key && (
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('player') ||
      key.toLowerCase().includes('athlete')
    )
  );
  
  if (nameColumns.length === 0) {
    // Try first column
    const firstKey = Object.keys(jsonData[0] || {})[0];
    if (firstKey) {
      nameColumns.push(firstKey);
    }
  }
  
  for (const row of jsonData) {
    for (const nameCol of nameColumns) {
      const name = row[nameCol];
      if (name) {
        const normalized = normalizeToFirstLast(String(name));
        if (normalized) {
          players.add(normalized);
          break; // Only add once per row
        }
      }
    }
  }
  
  return players;
}

async function compareLiftTestAndCombine() {
  console.log('📊 Comparing Lift Test and Combine Data\n');
  console.log('='.repeat(80));
  
  // File paths
  const liftTestPath = path.join(__dirname, '..', '..', 'Inseason 25 Nordbord and CMJ.xlsx');
  const combinePath = path.join(__dirname, '..', '..', '2025 Aggie Combine.xlsx');
  
  // Check if files exist
  if (!fs.existsSync(liftTestPath)) {
    console.error(`❌ Error: Lift test file not found: ${liftTestPath}`);
    return;
  }
  
  if (!fs.existsSync(combinePath)) {
    console.error(`❌ Error: Combine file not found: ${combinePath}`);
    return;
  }
  
  console.log('📁 Reading files...\n');
  
  // Extract players from lift test file (NordBoard + CMJ)
  console.log('Extracting players from lift test file (NordBoard + CMJ)...');
  const nordBoardPlayers = extractNordBoardPlayers(liftTestPath);
  const cmjPlayers = extractCMJPlayers(liftTestPath);
  
  // Combine both sets (lift test = NordBoard OR CMJ)
  const liftTestPlayers = new Set([...nordBoardPlayers, ...cmjPlayers]);
  
  console.log(`  NordBoard players: ${nordBoardPlayers.size}`);
  console.log(`  CMJ players: ${cmjPlayers.size}`);
  console.log(`  Total unique lift test players: ${liftTestPlayers.size}\n`);
  
  // Extract players from combine file
  console.log('Extracting players from combine file...');
  const combinePlayers = extractCombinePlayers(combinePath);
  console.log(`  Total combine players: ${combinePlayers.size}\n`);
  
  // Compare players
  console.log('='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));
  
  // Find players in both
  const playersInBoth = [];
  const playersOnlyLiftTest = [];
  const playersOnlyCombine = [];
  
  for (const player of liftTestPlayers) {
    const normalized = normalizeName(player);
    let found = false;
    
    for (const combinePlayer of combinePlayers) {
      if (normalizeName(combinePlayer) === normalized) {
        playersInBoth.push({ liftTest: player, combine: combinePlayer });
        found = true;
        break;
      }
    }
    
    if (!found) {
      playersOnlyLiftTest.push(player);
    }
  }
  
  for (const player of combinePlayers) {
    const normalized = normalizeName(player);
    let found = false;
    
    for (const liftTestPlayer of liftTestPlayers) {
      if (normalizeName(liftTestPlayer) === normalized) {
        found = true;
        break;
      }
    }
    
    if (!found) {
      playersOnlyCombine.push(player);
    }
  }
  
  // Display statistics
  console.log('\n📈 STATISTICS:');
  console.log('─'.repeat(80));
  console.log(`Lift Test Players:     ${liftTestPlayers.size}`);
  console.log(`Combine Players:          ${combinePlayers.size}`);
  console.log(`Players in BOTH:          ${playersInBoth.length}`);
  console.log(`Players ONLY in Lift Test: ${playersOnlyLiftTest.length}`);
  console.log(`Players ONLY in Combine:   ${playersOnlyCombine.length}`);
  
  // Calculate differences
  const difference = Math.abs(liftTestPlayers.size - combinePlayers.size);
  if (difference > 0) {
    console.log(`\n⚠️  DIFFERENCE: ${difference} more players in ${liftTestPlayers.size > combinePlayers.size ? 'Lift Test' : 'Combine'}`);
  } else {
    console.log(`\n✅ Both files have the same number of players`);
  }
  
  // Display players in both
  if (playersInBoth.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`✅ PLAYERS WITH DATA IN BOTH FILES (${playersInBoth.length}):`);
    console.log('='.repeat(80));
    playersInBoth.sort((a, b) => a.liftTest.localeCompare(b.liftTest));
    playersInBoth.forEach((player, i) => {
      console.log(`${String(i + 1).padStart(3)}. ${player.liftTest}`);
    });
  }
  
  // Display players only in lift test
  if (playersOnlyLiftTest.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`📋 PLAYERS WITH DATA ONLY IN LIFT TEST (${playersOnlyLiftTest.length}):`);
    console.log('='.repeat(80));
    playersOnlyLiftTest.sort();
    playersOnlyLiftTest.forEach((player, i) => {
      console.log(`${String(i + 1).padStart(3)}. ${player}`);
    });
  }
  
  // Display players only in combine
  if (playersOnlyCombine.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`📋 PLAYERS WITH DATA ONLY IN COMBINE (${playersOnlyCombine.length}):`);
    console.log('='.repeat(80));
    playersOnlyCombine.sort();
    playersOnlyCombine.forEach((player, i) => {
      console.log(`${String(i + 1).padStart(3)}. ${player}`);
    });
  }
  
  // Summary table
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY TABLE');
  console.log('='.repeat(80));
  console.log('Category'.padEnd(30) + 'Count');
  console.log('─'.repeat(80));
  console.log('Lift Test Only'.padEnd(30) + playersOnlyLiftTest.length);
  console.log('Combine Only'.padEnd(30) + playersOnlyCombine.length);
  console.log('Both Files'.padEnd(30) + playersInBoth.length);
  console.log('─'.repeat(80));
  console.log('Total Lift Test'.padEnd(30) + liftTestPlayers.size);
  console.log('Total Combine'.padEnd(30) + combinePlayers.size);
  console.log('='.repeat(80));
  
  console.log('\n✅ Comparison complete! (No database changes made)');
}

// Run the script
compareLiftTestAndCombine().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




