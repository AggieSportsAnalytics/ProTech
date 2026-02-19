// Compares names and alumni_names by id; removes from names anyone who is in both.
// Requires RLS on alumni_names to allow SELECT (see supabase_alumni_names_rls.sql if needed).
// Run from Frontend/ProTech: node remove_alumni_from_names.js
// Dry run (no deletes): node remove_alumni_from_names.js --dry-run
//
// IMPORTANT: If Athlete_Data has a foreign key to names with ON DELETE CASCADE, deleting
// from names will also delete those rows from Athlete_Data. Fix that first — see
// supabase_fix_names_athlete_data_cascade.sql — then run this script.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
	const envPath = path.join(__dirname, ".env");
	if (!fs.existsSync(envPath)) {
		console.error("Error: .env file not found at", envPath);
		process.exit(1);
	}
	const envContent = fs.readFileSync(envPath, "utf8");
	const env = {};
	envContent.split("\n").forEach((line) => {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			const [key, ...valueParts] = trimmed.split("=");
			if (key && valueParts.length > 0) {
				env[key.trim()] = valueParts.join("=").trim();
			}
		}
	});
	return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error("Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DRY_RUN = process.argv.includes("--dry-run");

function normalizeId(id) {
	if (id == null) return "";
	return String(id).trim().toLowerCase();
}

function normalizeName(name) {
	if (name == null) return "";
	return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
	// 1. Fetch names and alumni_names
	const { data: namesRows, error: errNames } = await supabase.from("names").select("id, name");
	if (errNames) {
		console.error("Error fetching names:", errNames.message);
		process.exit(1);
	}
	const namesList = namesRows || [];

	const { data: alumniRows, error: errAlumni } = await supabase.from("alumni_names").select("id, name");
	if (errAlumni) {
		console.error("Error fetching alumni_names:", errAlumni.message);
		process.exit(1);
	}
	const alumniList = alumniRows || [];

	if (alumniList.length === 0) {
		console.log("alumni_names is empty. Nothing to remove from names.");
		return;
	}

	// 2. Find ids in both (compare normalized so UUID casing doesn't matter)
	const alumniIdsNormalized = new Set(alumniList.map((r) => normalizeId(r.id)).filter(Boolean));
	let toRemove = namesList
		.filter((r) => alumniIdsNormalized.has(normalizeId(r.id)))
		.map((r) => r.id);

	// 3. Fallback: match by name if no id overlap
	if (toRemove.length === 0) {
		const alumniNamesNormalized = new Set(alumniList.map((r) => normalizeName(r.name)).filter(Boolean));
		toRemove = namesList
			.filter((r) => alumniNamesNormalized.has(normalizeName(r.name)))
			.map((r) => r.id);
	}

	if (toRemove.length === 0) {
		console.log("No one is in both names and alumni_names. Nothing to remove.");
		return;
	}

	const namesById = Object.fromEntries(namesList.map((r) => [r.id, r]));
	console.log(`Found ${toRemove.length} row(s) in both tables (will be removed from names):`);
	toRemove.forEach((id) => {
		const row = namesById[id];
		console.log(`  - ${id}  ${row?.name ?? "(no name)"}`);
	});

	if (DRY_RUN) {
		console.log("\n[DRY RUN] No rows were deleted. Run without --dry-run to remove these from names.");
		return;
	}

	const { error: deleteError } = await supabase.from("names").delete().in("id", toRemove);
	if (deleteError) {
		console.error("Error deleting from names:", deleteError.message);
		process.exit(1);
	}
	console.log(`\nRemoved ${toRemove.length} row(s) from names.`);
}

main();
