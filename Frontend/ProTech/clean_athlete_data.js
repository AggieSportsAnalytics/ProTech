// Script to clean and fix athlete_data table
// Removes corrupted entries and fixes data format
// Run with: node clean_athlete_data.js

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

// Check if a value is a valid year (2020-2030)
function isValidYear(year) {
  if (!year) return false;
  
  // Convert to number if it's a string
  const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
  
  // Check if it's a valid year in reasonable range
  return !isNaN(yearNum) && yearNum >= 2020 && yearNum <= 2030;
}

// Check if a value looks like a player name (contains comma or multiple words)
function isPlayerName(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  // Check if it contains comma (Last, First format) or multiple capitalized words
  return trimmed.includes(',') || (trimmed.split(/\s+/).length >= 2 && /[A-Z]/.test(trimmed));
}

// Check if a value is a valid numeric measurement
function isValidNumeric(value, field) {
  if (value === null || value === undefined) return true; // null is valid
  
  // Handle "NT" (No Test) - should be null
  if (value === 'NT' || value === 'nt' || value === 'N/A' || value === 'n/a') {
    return false; // Will be converted to null
  }
  
  // For numeric fields, check if it's a valid number
  if (typeof value === 'number') {
    // Check reasonable ranges based on field type
    if (field === 'bodyWeight' && (value < 100 || value > 500)) return false;
    if (field === 'verticalJump' && (value < 10 || value > 60)) return false;
    if (field === 'tenYard' && (value < 0.5 || value > 3.0)) return false;
    if (field === 'fortyYard' && (value < 3.0 || value > 10.0)) return false;
    if (field === 'flyingTen' && (value < 0.5 || value > 2.0)) return false;
    if (field === 'twentyYard' && (value < 1.0 || value > 5.0)) return false;
    if (field === 'nflShuttle' && (value < 3.0 || value > 8.0)) return false;
    if (field === 'proAgility' && (value < 3.0 || value > 8.0)) return false;
    if (field === 'laser20' && (value < 1.0 || value > 5.0)) return false;
    if (field === 'backSquat' && (value < 100 || value > 1000)) return false;
    if (field === 'hangClean' && (value < 100 || value > 500)) return false;
    if (field === 'inclineBench' && (value < 100 || value > 500)) return false;
    return true;
  }
  
  // For string values, check if it's a valid format
  if (typeof value === 'string') {
    // Check if it's a number string
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // Recursively check with numeric value
      return isValidNumeric(numValue, field);
    }
    
    // For broadJump, allow format like "9' 8\""
    if (field === 'broadJump' && (value.includes("'") || value.includes('"'))) {
      return true;
    }
    
    return false;
  }
  
  return false;
}

// Clean a single stat entry
function cleanStatEntry(entry) {
  // Check if year is valid
  if (!isValidYear(entry.year)) {
    return null; // Invalid year, discard
  }
  
  // Normalize year to string
  const year = String(entry.year);
  
  // Create cleaned entry with all fields
  const cleaned = {
    year: year,
    laser20: null,
    tenYard: null,
    backSquat: null,
    broadJump: null,
    flyingTen: null,
    fortyYard: null,
    hangClean: null,
    bodyWeight: null,
    nflShuttle: null,
    proAgility: null,
    twentyYard: null,
    inclineBench: null,
    verticalJump: null
  };
  
  // Clean each field
  const fields = [
    'laser20', 'tenYard', 'backSquat', 'broadJump', 'flyingTen', 
    'fortyYard', 'hangClean', 'bodyWeight', 'nflShuttle', 
    'proAgility', 'twentyYard', 'inclineBench', 'verticalJump'
  ];
  
  for (const field of fields) {
    const value = entry[field];
    
    // Skip if value is null/undefined
    if (value === null || value === undefined) {
      continue;
    }
    
    // Check if value is a player name (corrupted data)
    if (isPlayerName(value)) {
      continue; // Skip this field
    }
    
    // Handle "NT" and similar
    if (value === 'NT' || value === 'nt' || value === 'N/A' || value === 'n/a' || value === 'NA') {
      cleaned[field] = null;
      continue;
    }
    
    // Check if value is valid for this field
    if (!isValidNumeric(value, field)) {
      continue; // Skip invalid value
    }
    
    // Convert to appropriate type
    if (field === 'backSquat' || field === 'hangClean' || field === 'inclineBench' || field === 'bodyWeight') {
      // Integer fields
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(numValue) && Number.isInteger(numValue)) {
        cleaned[field] = numValue;
      } else if (!isNaN(numValue)) {
        cleaned[field] = Math.round(numValue);
      }
    } else if (field === 'broadJump') {
      // Keep as string (format like "9' 8\"")
      cleaned[field] = String(value);
    } else {
      // Other fields - convert to string for consistency
      if (typeof value === 'number') {
        // Convert to string, but keep reasonable precision
        if (field === 'verticalJump' || field === 'tenYard' || field === 'flyingTen' || 
            field === 'twentyYard' || field === 'nflShuttle' || field === 'proAgility' ||
            field === 'laser20' || field === 'fortyYard') {
          // Time/distance measurements - keep 2-3 decimal places
          cleaned[field] = value.toFixed(3).replace(/\.?0+$/, '');
        } else {
          cleaned[field] = String(value);
        }
      } else {
        cleaned[field] = String(value);
      }
    }
  }
  
  return cleaned;
}

// Clean stats array for an athlete
function cleanStatsArray(stats) {
  if (!stats || !Array.isArray(stats)) {
    return [];
  }
  
  const cleanedStats = [];
  const yearMap = new Map(); // Track best entry for each year
  
  for (const entry of stats) {
    const cleaned = cleanStatEntry(entry);
    
    if (!cleaned) {
      continue; // Entry was invalid, skip it
    }
    
    const year = cleaned.year;
    
    // If we already have an entry for this year, keep the one with more data
    if (yearMap.has(year)) {
      const existing = yearMap.get(year);
      
      // Count non-null fields
      const existingCount = Object.values(existing).filter(v => v !== null).length;
      const newCount = Object.values(cleaned).filter(v => v !== null).length;
      
      // Keep the one with more data
      if (newCount > existingCount) {
        yearMap.set(year, cleaned);
      }
    } else {
      yearMap.set(year, cleaned);
    }
  }
  
  // Convert map to array and sort by year (descending - newest first)
  return Array.from(yearMap.values()).sort((a, b) => {
    const yearA = parseInt(a.year, 10);
    const yearB = parseInt(b.year, 10);
    return yearB - yearA;
  });
}

async function cleanAthleteData() {
  console.log('🧹 Starting athlete data cleaning process...\n');
  console.log(`Connecting to: ${supabaseUrl}\n`);
  
  try {
    // Fetch all athlete data
    console.log('📊 Fetching all athlete data...');
    const { data: athletes, error: fetchError } = await supabase
      .from('Athlete_Data')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching athlete data:', fetchError);
      return;
    }
    
    if (!athletes || athletes.length === 0) {
      console.log('No athletes found in database');
      return;
    }
    
    console.log(`Found ${athletes.length} athletes\n`);
    
    // Process each athlete
    const updates = [];
    let totalEntriesBefore = 0;
    let totalEntriesAfter = 0;
    let athletesWithChanges = 0;
    
    for (const athlete of athletes) {
      const originalStats = athlete.stats || [];
      totalEntriesBefore += originalStats.length;
      
      const cleanedStats = cleanStatsArray(originalStats);
      totalEntriesAfter += cleanedStats.length;
      
      // Check if stats changed
      if (JSON.stringify(originalStats) !== JSON.stringify(cleanedStats)) {
        athletesWithChanges++;
        updates.push({
          id: athlete.id,
          name: athlete.name || 'Unknown',
          before: originalStats.length,
          after: cleanedStats.length,
          stats: cleanedStats
        });
      }
    }
    
    console.log('='.repeat(80));
    console.log('📊 CLEANING SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total athletes: ${athletes.length}`);
    console.log(`Athletes with changes: ${athletesWithChanges}`);
    console.log(`Total entries before: ${totalEntriesBefore}`);
    console.log(`Total entries after: ${totalEntriesAfter}`);
    console.log(`Entries removed: ${totalEntriesBefore - totalEntriesAfter}\n`);
    
    if (updates.length === 0) {
      console.log('✅ No changes needed. All data is already clean.');
      return;
    }
    
    // Show sample of changes
    console.log('Sample of changes:');
    updates.slice(0, 5).forEach((update, i) => {
      console.log(`\n${i + 1}. ${update.name} (ID: ${update.id})`);
      console.log(`   Before: ${update.before} entries`);
      console.log(`   After: ${update.after} entries`);
      console.log(`   Removed: ${update.before - update.after} corrupted entries`);
    });
    
    if (updates.length > 5) {
      console.log(`\n... and ${updates.length - 5} more athletes`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  WARNING: This will update the Athlete_Data table.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Apply updates
    console.log('Applying updates...\n');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      
      try {
        const { error } = await supabase
          .from('Athlete_Data')
          .update({ stats: update.stats })
          .eq('id', update.id);
        
        if (error) {
          console.error(`[${i + 1}/${updates.length}] ❌ Error updating ${update.name}:`, error.message);
          errorCount++;
        } else {
          console.log(`[${i + 1}/${updates.length}] ✅ Updated: ${update.name} (${update.before} → ${update.after} entries)`);
          successCount++;
        }
      } catch (error) {
        console.error(`[${i + 1}/${updates.length}] ❌ Error:`, error.message);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Cleaning complete!');
    console.log(`   Successfully updated: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total entries removed: ${totalEntriesBefore - totalEntriesAfter}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
cleanAthleteData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




