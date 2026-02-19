-- Why did deleting from "names" also delete from "Athlete_Data"?
-- Likely: there is a foreign key from Athlete_Data.id -> names.id with ON DELETE CASCADE.
-- So when a row in names is deleted, Postgres automatically deletes the row in Athlete_Data
-- that references that id.
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Step 1: List foreign keys touching "names" or "Athlete_Data" (to find the constraint name)
-- Step 2: Drop the CASCADE behavior or drop the FK so names and Athlete_Data are independent.

-- ---------- Step 1: Inspect constraints (run this first) ----------
-- This shows constraints that reference or are referenced by our tables.
SELECT
  tc.constraint_name,
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name IN ('names', 'Athlete_Data') OR ccu.table_name IN ('names', 'Athlete_Data'));

-- ---------- Step 2: Remove CASCADE (pick one) ----------
-- Option A: If the FK is on Athlete_Data (Athlete_Data.id -> names.id) with CASCADE,
-- drop the foreign key so that deleting from names no longer deletes from Athlete_Data.
-- Replace <constraint_name> with the constraint_name from Step 1 (e.g. Athlete_Data_id_fkey).
--
-- ALTER TABLE "Athlete_Data"
--   DROP CONSTRAINT IF EXISTS "Athlete_Data_id_fkey";
--
-- After that, names and Athlete_Data are independent: the script can delete from names
-- (moving someone to alumni) without touching Athlete_Data.

-- Option B: If you prefer to keep a foreign key but avoid CASCADE, use RESTRICT instead.
-- Then deleting from names will fail if Athlete_Data still has that id (so you cannot
-- delete from names for anyone who still has profile data — you’d have to drop the FK
-- for the “remove from names only” behavior).
--
-- ALTER TABLE "Athlete_Data"
--   DROP CONSTRAINT IF EXISTS "Athlete_Data_id_fkey";
-- ALTER TABLE "Athlete_Data"
--   ADD CONSTRAINT "Athlete_Data_id_fkey"
--   FOREIGN KEY (id) REFERENCES names(id) ON DELETE RESTRICT;

-- Restore data: if you have a backup of Athlete_Data, restore it. Supabase Pro has
-- point-in-time recovery; otherwise restore from your own backups if available.
