// Script to find and remove duplicate names with commas from Supabase
// Run with: node cleanup_duplicate_names.js

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
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicateNames() {
  try {
    console.log('Fetching all names from database...');
    
    // Fetch all names
    const { data: names, error: fetchError } = await supabase
      .from('names')
      .select('*');

    if (fetchError) {
      console.error('Error fetching names:', fetchError);
      return;
    }

    if (!names || names.length === 0) {
      console.log('No names found in database');
      return;
    }

    console.log(`Found ${names.length} total entries\n`);

    // Find entries with commas (last name, first name format)
    const entriesWithCommas = names.filter(entry => entry.name && entry.name.includes(','));
    
    console.log(`Found ${entriesWithCommas.length} entries with commas:`);
    entriesWithCommas.forEach(entry => {
      console.log(`  - ID: ${entry.id}, Name: "${entry.name}", Position: ${entry.position || 'N/A'}`);
    });

    // Normalize names for comparison (remove commas, trim, lowercase)
    function normalizeName(name) {
      return name.replace(/,/g, '').trim().toLowerCase();
    }

    // Group by normalized name
    const nameGroups = {};
    names.forEach(entry => {
      if (!entry.name) return;
      
      const normalized = normalizeName(entry.name);
      
      if (!nameGroups[normalized]) {
        nameGroups[normalized] = [];
      }
      nameGroups[normalized].push(entry);
    });

    // Find duplicates (same normalized name, different formats)
    const duplicates = Object.entries(nameGroups)
      .filter(([_, entries]) => entries.length > 1)
      .map(([normalized, entries]) => ({
        normalized,
        entries: entries.sort((a, b) => {
          // Sort: entries with commas first
          const aHasComma = a.name.includes(',');
          const bHasComma = b.name.includes(',');
          if (aHasComma && !bHasComma) return -1;
          if (!aHasComma && bHasComma) return 1;
          return 0;
        })
      }));

    console.log(`\nFound ${duplicates.length} groups of duplicate names:\n`);
    
    const idsToDelete = [];
    
    duplicates.forEach(({ normalized, entries }) => {
      console.log(`Normalized name: "${normalized}"`);
      entries.forEach(entry => {
        const hasComma = entry.name.includes(',');
        console.log(`  ${hasComma ? '[DELETE]' : '[KEEP]'} ID: ${entry.id}, Name: "${entry.name}", Position: ${entry.position || 'N/A'}`);
        
        if (hasComma) {
          idsToDelete.push(entry.id);
        }
      });
      console.log('');
    });

    // Also find standalone entries with commas that don't have duplicates
    const standaloneWithCommas = entriesWithCommas.filter(entry => {
      const normalized = normalizeName(entry.name);
      const group = nameGroups[normalized];
      return group && group.length === 1; // Only this entry
    });

    if (standaloneWithCommas.length > 0) {
      console.log(`\nFound ${standaloneWithCommas.length} standalone entries with commas (no duplicates):`);
      standaloneWithCommas.forEach(entry => {
        console.log(`  [DELETE] ID: ${entry.id}, Name: "${entry.name}", Position: ${entry.position || 'N/A'}`);
        idsToDelete.push(entry.id);
      });
    }

    if (idsToDelete.length === 0) {
      console.log('\n✅ No duplicate entries with commas found to delete.');
      return;
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`Total entries to delete: ${idsToDelete.length}`);
    console.log(`\nIDs to delete:`, idsToDelete.join(', '));

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete these entries from the database.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete entries in batches (Supabase has limits)
    console.log('Deleting entries...');
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('names')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
        continue;
      }

      deletedCount += batch.length;
      console.log(`Deleted ${deletedCount}/${idsToDelete.length} entries...`);
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} duplicate entries with commas.`);

  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupDuplicateNames();

