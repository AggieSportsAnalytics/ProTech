import { useState } from "react";
import * as XLSX from "xlsx";
import supabase from "../utils/supabase";
import { v4 as uuidv4 } from "uuid";
import Loader from "./Loader";

function CombineUpload() {
	const [excelFile, setExcelFile] = useState(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState("");
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	// Convert "Last, First" to "First Last"
	const normalizeToFirstLast = (name) => {
		if (!name) return null;
		const trimmed = String(name).trim();
		if (!trimmed.includes(',')) {
			return trimmed;
		}
		const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
		if (parts.length >= 2) {
			return `${parts[1]} ${parts[0]}`;
		}
		return trimmed;
	};

	// Normalize player name for matching (case-insensitive, handle variations)
	const normalizeName = (name) => {
		if (!name) return "";
		return String(name).replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
	};

	// Normalize date from "5/24/24" or Excel serial to "2024-05-24"
	const normalizeDate = (dateStr) => {
		if (!dateStr) return null;
		
		// Handle Excel date serial number
		if (typeof dateStr === 'number') {
			const excelEpoch = new Date(1899, 11, 30);
			const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
			return date.toISOString().split('T')[0];
		}
		
		// Handle string dates like "5/24/24" or "5/24/2024"
		const parts = String(dateStr).split('/');
		if (parts.length === 3) {
			let month = parseInt(parts[0], 10);
			let day = parseInt(parts[1], 10);
			let year = parseInt(parts[2], 10);
			
			// Handle 2-digit years
			if (year < 100) {
				year += 2000;
			}
			
			// Format as YYYY-MM-DD
			return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		}
		
		// Try to parse as ISO date
		try {
			const date = new Date(dateStr);
			if (!isNaN(date.getTime())) {
				return date.toISOString().split('T')[0];
			}
		} catch (e) {
			// Ignore
		}
		
		return null;
	};

	// Extract year from date (YYYY-MM-DD format)
	const extractYear = (dateStr) => {
		if (!dateStr) return null;
		const parts = dateStr.split('-');
		if (parts.length >= 1) {
			return parseInt(parts[0], 10);
		}
		return null;
	};

	// Parse broad jump from format like "8' 10.25"" to inches or keep as-is
	const parseBroadJump = (value) => {
		if (!value || value === 'NT') return null;
		const str = String(value).trim();
		// If it's already a number, return as string
		if (/^\d+\.?\d*$/.test(str)) {
			return str;
		}
		// Try to parse "8' 10.25"" format
		const match = str.match(/(\d+)'\s*(\d+\.?\d*)"/);
		if (match) {
			const feet = parseInt(match[1], 10);
			const inches = parseFloat(match[2]);
			return `${feet}' ${inches}"`;
		}
		// Return as-is if it doesn't match
		return str;
	};

	// Match player name from Excel to database
	const matchPlayerName = (excelName, allNames) => {
		const normalizedExcel = normalizeName(normalizeToFirstLast(excelName) || excelName);
		
		// First try exact match (case-insensitive)
		for (const dbName of allNames) {
			if (normalizeName(dbName.name) === normalizedExcel) {
				return dbName;
			}
		}
		
		// Try matching by last name (handle "Last, First" vs "First Last")
		const excelParts = normalizedExcel.split(' ');
		if (excelParts.length >= 2) {
			const excelLast = excelParts[excelParts.length - 1];
			for (const dbName of allNames) {
				const dbParts = normalizeName(dbName.name).split(' ');
				if (dbParts.length >= 2 && dbParts[dbParts.length - 1] === excelLast) {
					// Check if first names match (allowing for middle names/initials)
					const excelFirst = excelParts[0];
					const dbFirst = dbParts[0];
					if (excelFirst === dbFirst || 
					    excelFirst.startsWith(dbFirst) || 
					    dbFirst.startsWith(excelFirst) ||
					    (excelFirst.length === 1 && dbFirst.startsWith(excelFirst)) ||
					    (dbFirst.length === 1 && excelFirst.startsWith(dbFirst))) {
						return dbName;
					}
				}
			}
		}
		
		return null;
	};

	// Parse combine data from Excel file
	const parseCombineData = (worksheet) => {
		// Convert to array of arrays for easier parsing
		const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
		
		const players = [];
		let currentSection = null;
		let headerRow = null;
		
		// Position section identifiers
		const positionSections = ['DL', 'OL', 'LB', 'QB', 'RB', 'DB', 'TE', 'WR', 'Spec.'];
		
		for (let i = 0; i < data.length; i++) {
			const row = data[i];
			if (!row || row.length === 0) continue;
			
			// Check if this is a position section header
			const firstCell = String(row[0] || '').trim();
			if (positionSections.some(pos => firstCell === pos || firstCell.startsWith(pos))) {
				currentSection = firstCell.split(/\s/)[0]; // Get just the position code
				headerRow = null; // Reset header row for new section
				continue;
			}
			
			// Check if this is a header row (contains column names like "Date", "Bwt", "Vertical Jump")
			const rowStr = row.join(' ').toLowerCase();
			if (rowStr.includes('date') && rowStr.includes('bwt') && rowStr.includes('vertical')) {
				headerRow = row;
				continue;
			}
			
			// Skip if we don't have a section or header row yet
			if (!currentSection || !headerRow) continue;
			
			// Find name column (usually first column, or check for name-like values)
			let nameValue = null;
			for (let j = 0; j < Math.min(row.length, 5); j++) {
				const cell = String(row[j] || '').trim();
				if (cell && cell.includes(',') && cell.length > 3) {
					nameValue = cell;
					break;
				}
			}
			
			if (!nameValue) continue; // Skip rows without names
			
			// Find column indices
			const getColIndex = (searchTerms) => {
				for (let j = 0; j < headerRow.length; j++) {
					const header = String(headerRow[j] || '').toLowerCase();
					if (searchTerms.some(term => header.includes(term))) {
						return j;
					}
				}
				return -1;
			};
			
			const dateCol = getColIndex(['date']);
			const bwtCol = getColIndex(['bwt', 'weight', 'body weight']);
			const vertCol = getColIndex(['vertical jump', 'vertical']);
			const broadCol = getColIndex(['broad jump', 'broad']);
			const tenYdCol = getColIndex(['10yd', '10 yd', '10-yard']);
			const flying10Col = getColIndex(['flying 10', 'flying10']);
			const twentyYdCol = getColIndex(['20yd', '20 yd', '20-yard']);
			const laser20Col = getColIndex(['laser 20', 'laser20']);
			const fortyYdCol = getColIndex(['40yd', '40 yd', '40-yard']);
			const laser40Col = getColIndex(['laser 40', 'laser40']);
			const nflShuttleCol = getColIndex(['nfl speed score', 'nfl speed', 'nflshuttle', 'nfl shuttle']);
			
			// Extract data
			const dateValue = dateCol >= 0 ? row[dateCol] : null;
			const date = normalizeDate(dateValue);
			if (!date) continue; // Skip rows without valid dates
			
			const playerData = {
				name: nameValue,
				position: currentSection,
				date: date,
				year: extractYear(date),
				bodyWeight: bwtCol >= 0 ? (row[bwtCol] || null) : null,
				verticalJump: vertCol >= 0 ? (row[vertCol] || null) : null,
				broadJump: broadCol >= 0 ? parseBroadJump(row[broadCol]) : null,
				tenYard: tenYdCol >= 0 ? (row[tenYdCol] || null) : null,
				flyingTen: flying10Col >= 0 ? (row[flying10Col] || null) : null,
				twentyYard: twentyYdCol >= 0 ? (row[twentyYdCol] || null) : null,
				laser20: laser20Col >= 0 ? (row[laser20Col] || null) : null,
				fortyYard: fortyYdCol >= 0 ? (row[fortyYdCol] || null) : null,
				laser40: laser40Col >= 0 ? (row[laser40Col] || null) : null,
				nflShuttle: nflShuttleCol >= 0 ? (row[nflShuttleCol] || null) : null,
			};
			
			players.push(playerData);
		}
		
		return players;
	};

	const handleFileUpload = async () => {
		if (!excelFile) {
			setError("Please select an Excel file.");
			return;
		}

		setIsUploading(true);
		setError("");
		setSuccessMessage("");
		setUploadProgress("Reading Excel file...");

		try {
			// Read Excel file
			const data = await excelFile.arrayBuffer();
			const workbook = XLSX.read(data, { type: 'array' });
			
			// Use first sheet (combine files typically have one sheet)
			const sheetName = workbook.SheetNames[0];
			if (!sheetName) {
				throw new Error("Excel file has no sheets.");
			}

			const worksheet = workbook.Sheets[sheetName];
			setUploadProgress("Parsing combine data...");
			
			// Parse combine data
			const parsedPlayers = parseCombineData(worksheet);
			
			if (parsedPlayers.length === 0) {
				throw new Error("No valid player data found in Excel file.");
			}

			setUploadProgress(`Found ${parsedPlayers.length} data entries. Fetching player names from database...`);

			// Get all player names from database
			const { data: allNames, error: namesError } = await supabase
				.from("names")
				.select("id, name, position");

			if (namesError) throw namesError;

			setUploadProgress("Matching players and processing data...");

			// Process each player entry
			const statsToAdd = new Map(); // playerId -> array of stats
			const newPlayers = new Map(); // normalizedName -> { name, position, stats }
			let processedCount = 0;
			let skippedCount = 0;
			let duplicateCount = 0;

			for (const playerData of parsedPlayers) {
				// Match or create player
				let playerId = null;
				let playerName = normalizeToFirstLast(playerData.name);
				
				if (!playerName) {
					skippedCount++;
					continue;
				}

				const matchedPlayer = matchPlayerName(playerData.name, allNames || []);
				
				if (matchedPlayer) {
					playerId = matchedPlayer.id;
				} else {
					// New player - create entry
					const normalized = normalizeName(playerName);
					if (!newPlayers.has(normalized)) {
						const newId = uuidv4();
						newPlayers.set(normalized, {
							id: newId,
							name: playerName,
							position: playerData.position?.toLowerCase() || null,
							stats: []
						});
						playerId = newId;
					} else {
						playerId = newPlayers.get(normalized).id;
					}
				}

				// Helper to parse numeric value or return null
				const parseNumeric = (val) => {
					if (!val || val === 'NT' || val === '' || val === null) return null;
					const num = Number(val);
					return isNaN(num) ? null : num;
				};

				// Helper to parse string value or return null
				const parseString = (val) => {
					if (!val || val === 'NT' || val === '' || val === null) return null;
					return String(val);
				};

				// Create stats object matching exact format
				const statsObj = {
					year: String(playerData.year),
					laser20: parseString(playerData.laser20),
					tenYard: parseString(playerData.tenYard),
					backSquat: parseNumeric(playerData.backSquat),
					broadJump: parseString(playerData.broadJump),
					flyingTen: parseString(playerData.flyingTen),
					fortyYard: parseString(playerData.fortyYard),
					hangClean: parseNumeric(playerData.hangClean),
					bodyWeight: parseNumeric(playerData.bodyWeight),
					nflShuttle: parseNumeric(playerData.nflShuttle),
					proAgility: null,
					twentyYard: parseString(playerData.twentyYard),
					inclineBench: parseNumeric(playerData.inclineBench),
					verticalJump: parseString(playerData.verticalJump),
				};

				// Check for duplicates (same player, same date)
				if (!statsToAdd.has(playerId)) {
					statsToAdd.set(playerId, []);
				}
				
				const existingStats = statsToAdd.get(playerId);
				// Check for duplicate by year (data should stack by year)
				const isDuplicate = existingStats.some(s => String(s.year) === String(statsObj.year));
				
				if (isDuplicate) {
					duplicateCount++;
					continue;
				}

				existingStats.push(statsObj);
				processedCount++;
			}

			setUploadProgress(`Creating ${newPlayers.size} new players...`);

			// Create new players in names table and Athlete_Data table
			for (const [normalized, playerInfo] of newPlayers.entries()) {
				try {
					// Insert into names table
					const { error: namesError } = await supabase
						.from("names")
						.insert([{
							id: playerInfo.id,
							name: playerInfo.name,
							position: playerInfo.position
						}]);

					if (namesError) {
						console.error(`Error inserting into names for ${playerInfo.name}:`, namesError);
						continue;
					}

					// Insert into Athlete_Data table
					const { error: dataError } = await supabase
						.from("Athlete_Data")
						.insert([{
							id: playerInfo.id,
							name: playerInfo.name,
							position: playerInfo.position,
							height: null,
							wing: null,
							hand: null,
							stats: []
						}]);

					if (dataError) {
						// If permission error, stop and show message
						if (dataError.code === '42501' || dataError.message?.includes('403') || dataError.message?.includes('406') || dataError.message?.includes('row-level security')) {
							setError(`RLS Policy Error: The Athlete_Data table has Row Level Security enabled. Please run this SQL in Supabase to allow operations:\n\n` +
								`ALTER TABLE "Athlete_Data" DISABLE ROW LEVEL SECURITY;\n\n` +
								`Or create appropriate RLS policies. Error: ${dataError.message}`);
							setIsUploading(false);
							return;
						}
						console.error(`Error inserting into Athlete_Data for ${playerInfo.name}:`, dataError);
					}
				} catch (err) {
					console.error(`Error creating player ${playerInfo.name}:`, err);
				}
			}

			setUploadProgress(`Updating ${statsToAdd.size} players with combine data...`);

			// Update existing players or new players with stats
			let updateCount = 0;
			let errorCount = 0;

			for (const [playerId, statsArray] of statsToAdd.entries()) {
				try {
					// Get player info from names table first (required for upsert)
					const { data: playerInfo, error: playerInfoError } = await supabase
						.from("names")
						.select("name, position")
						.eq("id", playerId)
						.single();

					if (playerInfoError) {
						console.error(`Error fetching player info for ${playerId}:`, playerInfoError);
						errorCount++;
						continue;
					}

					// Get existing stats (use maybeSingle to handle case where player doesn't exist yet)
					const { data: existingData, error: fetchError } = await supabase
						.from("Athlete_Data")
						.select("stats, height, wing, hand")
						.eq("id", playerId)
						.maybeSingle();

					// If 403 or 406 error, the table might not exist or have permissions issues
					if (fetchError && fetchError.code !== 'PGRST116') {
						// PGRST116 is "no rows returned" which is fine, but other errors might be permission issues
						if (fetchError.code === '42501' || fetchError.message?.includes('403') || fetchError.message?.includes('406') || fetchError.message?.includes('row-level security')) {
							setError(`RLS Policy Error: The Athlete_Data table has Row Level Security enabled. Please run this SQL in Supabase to allow operations:\n\n` +
								`ALTER TABLE "Athlete_Data" DISABLE ROW LEVEL SECURITY;\n\n` +
								`Or create appropriate RLS policies. Error: ${fetchError.message}`);
							setIsUploading(false);
							return;
						}
						console.error(`Error fetching stats for player ${playerId}:`, fetchError);
						errorCount++;
						continue;
					}

					const existingStats = existingData?.stats || [];
					
					// Merge new stats with existing stats (avoid duplicates by year)
					const mergedStats = [...existingStats];
					for (const newStat of statsArray) {
						// Check if stat with same year already exists
						const existingIndex = mergedStats.findIndex(s => String(s.year) === String(newStat.year));
						if (existingIndex >= 0) {
							// Merge stats - keep existing values, only update if new value is not null
							const existing = mergedStats[existingIndex];
							mergedStats[existingIndex] = {
								...existing,
								// Update fields if new value is not null
								laser20: newStat.laser20 !== null ? newStat.laser20 : existing.laser20,
								tenYard: newStat.tenYard !== null ? newStat.tenYard : existing.tenYard,
								backSquat: newStat.backSquat !== null ? newStat.backSquat : existing.backSquat,
								broadJump: newStat.broadJump !== null ? newStat.broadJump : existing.broadJump,
								flyingTen: newStat.flyingTen !== null ? newStat.flyingTen : existing.flyingTen,
								fortyYard: newStat.fortyYard !== null ? newStat.fortyYard : existing.fortyYard,
								hangClean: newStat.hangClean !== null ? newStat.hangClean : existing.hangClean,
								bodyWeight: newStat.bodyWeight !== null ? newStat.bodyWeight : existing.bodyWeight,
								nflShuttle: newStat.nflShuttle !== null ? newStat.nflShuttle : existing.nflShuttle,
								proAgility: newStat.proAgility !== null ? newStat.proAgility : existing.proAgility,
								twentyYard: newStat.twentyYard !== null ? newStat.twentyYard : existing.twentyYard,
								inclineBench: newStat.inclineBench !== null ? newStat.inclineBench : existing.inclineBench,
								verticalJump: newStat.verticalJump !== null ? newStat.verticalJump : existing.verticalJump,
							};
						} else {
							// New year entry - add it
							mergedStats.push(newStat);
						}
					}

					// Update database - use upsert with all required fields in case the record doesn't exist yet
					const { error: updateError } = await supabase
						.from("Athlete_Data")
						.upsert({
							id: playerId,
							name: playerInfo.name,
							position: playerInfo.position?.toLowerCase() || null,
							height: existingData?.height || null,
							wing: existingData?.wing || null,
							hand: existingData?.hand || null,
							stats: mergedStats
						}, {
							onConflict: 'id'
						});

					if (updateError) {
						// If permission error, stop and show message
						if (updateError.code === '42501' || updateError.message?.includes('403') || updateError.message?.includes('406') || updateError.message?.includes('row-level security')) {
							setError(`RLS Policy Error: The Athlete_Data table has Row Level Security enabled. Please run this SQL in Supabase to allow operations:\n\n` +
								`ALTER TABLE "Athlete_Data" DISABLE ROW LEVEL SECURITY;\n\n` +
								`Or create appropriate RLS policies. Error: ${updateError.message}`);
							setIsUploading(false);
							return;
						}
						console.error(`Error updating stats for player ${playerId}:`, updateError);
						errorCount++;
					} else {
						updateCount++;
					}
				} catch (err) {
					console.error(`Error processing player ${playerId}:`, err);
					errorCount++;
				}
			}

			setIsUploading(false);
			setSuccessMessage(
				`Successfully processed combine data!\n` +
				`- Processed: ${processedCount} entries\n` +
				`- New players created: ${newPlayers.size}\n` +
				`- Players updated: ${updateCount}\n` +
				`- Duplicates skipped: ${duplicateCount}\n` +
				`- Errors: ${errorCount}`
			);
			setUploadProgress("");
			setExcelFile(null);
			
		} catch (err) {
			console.error("Error uploading combine data:", err);
			setError(err.message || "Failed to upload combine data.");
			setIsUploading(false);
			setUploadProgress("");
		}
	};

	return (
		<div className="bg-white/5 border border-[#FFBF00]/20 rounded-lg p-6">
			<h2 className="text-xl font-semibold text-[#FFBF00] mb-4">Upload Combine Excel File</h2>
			<p className="text-sm text-gray-300 mb-4">
				Upload a combine Excel file (e.g., aggiecombine.xlsx) with position sections (DL, OL, LB, QB, RB, DB, TE, WR, Spec.)
			</p>
			
			<div className="flex flex-col gap-3">
				<input
					type="file"
					accept=".xlsx,.xls"
					onChange={(e) => {
						setExcelFile(e.target.files?.[0] || null);
						setError("");
						setSuccessMessage("");
					}}
					className="border border-gray-300 rounded px-3 py-2 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#FFBF00] file:text-[#022851] hover:file:bg-[#FFD700] cursor-pointer"
					disabled={isUploading}
				/>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleFileUpload}
						className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
						disabled={isUploading || !excelFile}
					>
						{isUploading ? "Uploading..." : "Upload"}
					</button>
				</div>
				{uploadProgress && (
					<div className="mt-2">
						{isUploading && <Loader />}
						<p className="text-sm text-yellow-300 mt-2">{uploadProgress}</p>
					</div>
				)}
				{error && (
					<div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2">
						{error}
					</div>
				)}
				{successMessage && (
					<div className="text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-2 whitespace-pre-line">
						{successMessage}
					</div>
				)}
			</div>
		</div>
	);
}

export default CombineUpload;

