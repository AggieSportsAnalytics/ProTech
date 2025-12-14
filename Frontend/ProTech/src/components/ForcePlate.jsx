import { useState, useEffect } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import supabase from "../utils/supabase";
import Loader from "./Loader";

function ForcePlate({ id, onHasData }) {
	const [forcePlateData, setForcePlateData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [keyCounts, setKeyCounts] = useState({});
	const [athleteName, setAthleteName] = useState("");
	const [activeForm, setActiveForm] = useState(null);
	const [activeRemoveView, setActiveRemoveView] = useState(null);
	const [formDate, setFormDate] = useState("");
	const [formValue, setFormValue] = useState("");
	const [formError, setFormError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [uploadMode, setUploadMode] = useState(null); // null, 'single', or 'excel'
	const [excelFile, setExcelFile] = useState(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState("");

	const fetchAthleteName = async () => {
		if (!id) return;
		const { data } = await supabase
			.from("names")
			.select("name")
			.eq("id", id)
			.single();
		if (data?.name) {
			setAthleteName(data.name);
			return data.name;
		}
		return "";
	};

	const fetchForcePlateData = async () => {
		setLoading(true);
		const { data: baselineData, error: baselineError } = await supabase
			.from("ForcePlate_Baseline")
			.select("*")
			.eq("id", id);

		const { data: weeklyData, error: weeklyError } = await supabase
			.from("ForcePlate_Weekly")
			.select("*")
			.eq("id", id);

		if (baselineError || weeklyError) {
			console.error("Supabase error:", baselineError || weeklyError);
			setError((baselineError || weeklyError)?.message || "Unknown error");
			if (onHasData) onHasData(false);
			setForcePlateData([]);
			setLoading(false);
			return;
		}

		const combined = [...(baselineData || []), ...(weeklyData || [])];
		const sortedData = combined.sort(
			(a, b) => new Date(a.date) - new Date(b.date),
		);

		const counts = {
			name: 0,
			date: 0,
			rsi_modified_meters_sec: 0,
			jump_height_cm: 0,
			concentric_impulse_asym_percent_L: 0,
			concentric_impulse_asym_percent_R: 0,
			eccentric_deceleration_impulse_asym_percent_L: 0,
			eccentric_deceleration_impulse_asym_percent_R: 0,
			landing_impulse_asym_percent_L: 0,
			landing_impulse_asym_percent_R: 0,
		};
		sortedData.forEach((item) => {
			Object.entries(item).forEach(([key, value]) => {
				if (value !== null && value !== undefined) {
					counts[key] += 1;
				}
			});
		});

		setKeyCounts(counts);
		setForcePlateData(sortedData);
		if (sortedData[0]?.name) {
			setAthleteName(sortedData[0].name);
		}

		if (onHasData) {
			const metricKeys = [
				"rsi_modified_meters_sec",
				"jump_height_cm",
				"concentric_impulse_asym_percent_L",
				"concentric_impulse_asym_percent_R",
				"eccentric_deceleration_impulse_asym_percent_L",
				"eccentric_deceleration_impulse_asym_percent_R",
				"landing_impulse_asym_percent_L",
				"landing_impulse_asym_percent_R",
			];
			const hasAny = metricKeys.some((k) => (counts[k] || 0) > 0);
			onHasData(hasAny);
		}

		setLoading(false);
	};

	useEffect(() => {
		if (id) {
			fetchForcePlateData();
		}
	}, [id, onHasData]);

	useEffect(() => {
		if (!athleteName && id) {
			fetchAthleteName();
		}
	}, [athleteName, id]);

	const closeForm = () => {
		setActiveForm(null);
		setUploadMode(null);
		setFormDate("");
		setFormValue("");
		setFormError("");
		setExcelFile(null);
	};

	// Normalize date from "8/1/2025" to "2025-08-01"
	const normalizeDate = (dateStr) => {
		if (!dateStr) return null;
		
		// Handle Excel date serial number
		if (typeof dateStr === 'number') {
			const excelEpoch = new Date(1899, 11, 30);
			const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
			return date.toISOString().split('T')[0];
		}
		
		// Handle string dates like "8/1/2025" or "8/1/25"
		const parts = dateStr.toString().split('/');
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

	// Normalize player name for matching (case-insensitive, handle variations)
	const normalizeName = (name) => {
		if (!name) return "";
		// Remove commas, extra spaces, convert to lowercase
		return name.toString().replace(/,/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
	};

	// Match player name from Excel to database
	const matchPlayerName = async (excelName, allNames) => {
		const normalizedExcel = normalizeName(excelName);
		
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
					// Check if first names match (allowing for middle names)
					const excelFirst = excelParts[0];
					const dbFirst = dbParts[0];
					if (excelFirst === dbFirst || excelFirst.startsWith(dbFirst) || dbFirst.startsWith(excelFirst)) {
						return dbName;
					}
				}
			}
		}
		
		return null;
	};

	// Handle Excel file upload
	const handleExcelUpload = async (field) => {
		if (!excelFile) {
			setFormError("Please select an Excel file.");
			return;
		}

		setIsUploading(true);
		setFormError("");
		setUploadProgress("Reading Excel file...");

		try {
			// Read Excel file
			const data = await excelFile.arrayBuffer();
			const workbook = XLSX.read(data, { type: 'array' });
			
			// Find the ForcePlate/CMJ sheet (case-insensitive)
			let sheetName = null;
			for (const name of workbook.SheetNames) {
				if (name.toLowerCase().includes('forceplate') || name.toLowerCase().includes('force_plate') || name.toLowerCase().includes('cmj')) {
					sheetName = name;
					break;
				}
			}
			
			if (!sheetName) {
				throw new Error("Could not find ForcePlate/CMJ sheet in Excel file. Please ensure the sheet is named 'CMJ' or 'ForcePlate'.");
			}

			const worksheet = workbook.Sheets[sheetName];
			const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

			if (jsonData.length === 0) {
				throw new Error("Excel file is empty or has no data.");
			}

			setUploadProgress("Fetching player names from database...");

			// Get all player names from database
			const { data: allNames, error: namesError } = await supabase
				.from("names")
				.select("id, name");

			if (namesError) throw namesError;

			// Determine which column base name to extract based on field
			let excelColumnBase = null;
			if (field === "rsi_modified_meters_sec") {
				excelColumnBase = "RSI-modified [m/s]";
			} else if (field === "jump_height_cm") {
				excelColumnBase = "Jump Height (Imp-Mom) [cm]";
			}

			if (!excelColumnBase) {
				throw new Error(`Unknown field: ${field}`);
			}

			setUploadProgress("Processing data...");

			// Process each row - handle wide format with multiple date columns
			const uploads = [];
			let skipped = 0;
			let processed = 0;

			for (const row of jsonData) {
				const playerName = row["Name"] || row["name"];
				
				// Skip if no player name
				if (!playerName) {
					skipped++;
					continue;
				}

				// Match player name
				const matchedPlayer = await matchPlayerName(playerName, allNames);
				if (!matchedPlayer) {
					skipped++;
					continue;
				}

				// Only process if this is the current player
				if (matchedPlayer.id !== id) {
					continue;
				}

				// Find all date columns (Date, Date_1, Date_2, etc.)
				const dateColumns = Object.keys(row).filter(
					key => key.toLowerCase().includes('date') && !key.toLowerCase().includes('avg') && row[key] !== null && row[key] !== undefined
				);

				// Process each date column
				for (const dateCol of dateColumns) {
					const dateValue = row[dateCol];
					if (!dateValue) continue;

					// Find corresponding metric column
					// For "Date", look for "RSI-modified [m/s] " (with trailing space)
					// For "Date_1", look for "RSI-modified [m/s] _1", etc.
					let metricCol = null;
					if (dateCol === "Date") {
						// Try with and without trailing space
						metricCol = row[excelColumnBase] !== undefined ? excelColumnBase : 
						            row[excelColumnBase + " "] !== undefined ? excelColumnBase + " " : null;
					} else {
						// For Date_1, Date_2, etc., look for _1, _2 suffix
						const suffix = dateCol.replace("Date", "").replace(" UTC", "");
						metricCol = row[excelColumnBase + suffix] !== undefined ? excelColumnBase + suffix :
						            row[excelColumnBase + " " + suffix] !== undefined ? excelColumnBase + " " + suffix : null;
					}

					if (!metricCol || row[metricCol] === null || row[metricCol] === undefined || row[metricCol] === "") {
						skipped++;
						continue;
					}

					const metricValue = row[metricCol];

					// Normalize date
					const normalizedDate = normalizeDate(dateValue);
					if (!normalizedDate) {
						skipped++;
						continue;
					}

					// Check if date already exists in database
					const { data: existingRecord } = await supabase
						.from("ForcePlate_Baseline")
						.select(field)
						.eq("id", matchedPlayer.id)
						.eq("date", normalizedDate)
						.maybeSingle();
					
					if (existingRecord && existingRecord[field] !== null && existingRecord[field] !== undefined) {
						skipped++;
						continue;
					}

					// Convert metric value to number (handle string percentages)
					let numericValue = Number(metricValue);
					if (Number.isNaN(numericValue)) {
						// Try to parse as string number
						const cleaned = String(metricValue).replace(/[^\d.-]/g, '');
						numericValue = Number(cleaned);
						if (Number.isNaN(numericValue)) {
							skipped++;
							continue;
						}
					}

					uploads.push({
						id: matchedPlayer.id,
						name: matchedPlayer.name,
						date: normalizedDate,
						field: field,
						value: numericValue,
					});

					processed++;
				}
			}

			if (uploads.length === 0) {
				setFormError(`No valid data to upload. Processed: ${processed}, Skipped: ${skipped}`);
				setIsUploading(false);
				return;
			}

			setUploadProgress(`Uploading ${uploads.length} data points...`);

			// Upload data in batches
			let successCount = 0;
			let errorCount = 0;

			for (const upload of uploads) {
				try {
					// Check if entry exists in Baseline table
					const { data: existingRecord } = await supabase
						.from("ForcePlate_Baseline")
						.select("*")
						.eq("id", upload.id)
						.eq("date", upload.date)
						.maybeSingle();

					if (existingRecord) {
						// Update existing record
						const { error } = await supabase
							.from("ForcePlate_Baseline")
							.update({ [upload.field]: upload.value })
							.eq("id", upload.id)
							.eq("date", upload.date);

						if (error) throw error;
					} else {
						// Create new record
						const payload = {
							id: upload.id,
							name: upload.name,
							date: upload.date,
							rsi_modified_meters_sec: null,
							jump_height_cm: null,
							concentric_impulse_asym_percent_L: null,
							concentric_impulse_asym_percent_R: null,
							eccentric_deceleration_impulse_asym_percent_L: null,
							eccentric_deceleration_impulse_asym_percent_R: null,
							landing_impulse_asym_percent_L: null,
							landing_impulse_asym_percent_R: null,
							[upload.field]: upload.value,
						};

						const { error } = await supabase
							.from("ForcePlate_Baseline")
							.insert([payload]);

						if (error) throw error;
					}

					successCount++;
				} catch (err) {
					console.error(`Error uploading data for ${upload.date}:`, err);
					errorCount++;
				}
			}

			setUploadProgress("");
			closeForm();
			await fetchForcePlateData();
			
			alert(`Upload complete! Successfully uploaded: ${successCount}, Errors: ${errorCount}, Skipped: ${skipped}`);
		} catch (err) {
			console.error("Error processing Excel file:", err);
			setFormError(err.message || "Failed to process Excel file.");
		} finally {
			setIsUploading(false);
		}
	};

	const handleDeleteData = async (date, field) => {
		if (!confirm(`Are you sure you want to delete the ${field} data for ${date}?`)) {
			return;
		}

		setIsDeleting(true);
		try {
			// Get the entry to check if it has other fields
			const entry = forcePlateData.find((e) => e.date === date);
			
			if (!entry) {
				throw new Error("Entry not found");
			}

			// Check if entry has other non-null fields
			const allFields = [
				"rsi_modified_meters_sec",
				"jump_height_cm",
				"concentric_impulse_asym_percent_L",
				"concentric_impulse_asym_percent_R",
				"eccentric_deceleration_impulse_asym_percent_L",
				"eccentric_deceleration_impulse_asym_percent_R",
				"landing_impulse_asym_percent_L",
				"landing_impulse_asym_percent_R",
			];
			
			const otherFields = allFields.filter(
				(f) => f !== field && entry[f] !== null && entry[f] !== undefined
			);

			// Check which table the entry is in (Baseline or Weekly)
			const { data: baselineEntry } = await supabase
				.from("ForcePlate_Baseline")
				.select("*")
				.eq("id", id)
				.eq("date", date)
				.maybeSingle();

			const { data: weeklyEntry } = await supabase
				.from("ForcePlate_Weekly")
				.select("*")
				.eq("id", id)
				.eq("date", date)
				.maybeSingle();

			const tableName = baselineEntry ? "ForcePlate_Baseline" : "ForcePlate_Weekly";

			if (otherFields.length > 0) {
				// Update the entry to set this field to null
				const { error } = await supabase
					.from(tableName)
					.update({ [field]: null })
					.eq("id", id)
					.eq("date", date);

				if (error) throw error;
			} else {
				// Delete the entire entry if no other fields exist
				const { error } = await supabase
					.from(tableName)
					.delete()
					.eq("id", id)
					.eq("date", date);

				if (error) throw error;
			}

			await fetchForcePlateData();
			setActiveRemoveView(null);
		} catch (err) {
			console.error("Error deleting data:", err);
			alert(err.message || "Failed to delete data.");
		} finally {
			setIsDeleting(false);
		}
	};

	const renderRemoveView = (field, label) => {
		if (activeRemoveView !== field) return null;

		const fieldData = forcePlateData
			.filter((entry) => entry[field] !== null && entry[field] !== undefined)
			.map((entry) => ({
				date: entry.date,
				value: entry[field],
			}))
			.sort((a, b) => new Date(a.date) - new Date(b.date));

		return (
			<div className="bg-white/10 border border-[#FFBF00]/30 rounded-lg p-4 mb-6">
				<p className="text-sm font-semibold text-white mb-4">
					Remove {label} data points
				</p>
				{fieldData.length > 0 ? (
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{fieldData.map((item, index) => (
							<div
								key={index}
								className="flex justify-between items-center bg-white/5 rounded px-3 py-2 hover:bg-white/10 transition-colors"
							>
								<div className="text-white">
									<span className="font-medium">{item.date}</span>
									<span className="ml-3 text-gray-300">: {item.value}</span>
								</div>
								<button
									type="button"
									onClick={() => handleDeleteData(item.date, field)}
									disabled={isDeleting}
									className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
								>
									Remove
								</button>
							</div>
						))}
					</div>
				) : (
					<p className="text-gray-400 text-sm">No data points to remove</p>
				)}
				<button
					type="button"
					onClick={() => setActiveRemoveView(null)}
					className="mt-4 border border-white/40 text-white px-4 py-2 rounded-lg text-sm"
				>
					Close
				</button>
			</div>
		);
	};

	const handleForcePlateSave = async (field) => {
		if (!formDate || formValue === "") {
			setFormError("Please provide both a date and a value.");
			return;
		}

		const numericValue = Number(formValue);
		if (Number.isNaN(numericValue)) {
			setFormError("Value must be a valid number.");
			return;
		}

		setIsSubmitting(true);
		setFormError("");

		try {
			const { data: existingRecord } = await supabase
				.from("ForcePlate_Baseline")
				.select("*")
				.eq("id", id)
				.eq("date", formDate)
				.maybeSingle();

			let nameToUse = existingRecord?.name || athleteName;
			if (!nameToUse) {
				nameToUse = await fetchAthleteName();
			}

			const payload = existingRecord
				? { ...existingRecord, [field]: numericValue }
				: {
						id,
						name: nameToUse,
						date: formDate,
						rsi_modified_meters_sec: null,
						jump_height_cm: null,
						concentric_impulse_asym_percent_L: null,
						concentric_impulse_asym_percent_R: null,
						eccentric_deceleration_impulse_asym_percent_L: null,
						eccentric_deceleration_impulse_asym_percent_R: null,
						landing_impulse_asym_percent_L: null,
						landing_impulse_asym_percent_R: null,
						[field]: numericValue,
				  };

			const { error } = existingRecord
				? await supabase
						.from("ForcePlate_Baseline")
						.update({ [field]: numericValue })
						.eq("id", id)
						.eq("date", formDate)
				: await supabase.from("ForcePlate_Baseline").insert([payload]);

			if (error) {
				throw error;
			}

			closeForm();
			await fetchForcePlateData();
		} catch (err) {
			console.error("Error saving force plate data:", err);
			setFormError(err.message || "Failed to save data.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderForm = (field, label) =>
		activeForm === field && (
			<div className="bg-white/10 border border-[#FFBF00]/30 rounded-lg p-4 mb-6">
				<p className="text-sm font-semibold text-white mb-2">
					Add {label} data point
				</p>
				
				{!uploadMode && (
					<div className="flex gap-2 mb-4">
						<button
							type="button"
							onClick={() => setUploadMode('single')}
							className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
						>
							Single Entry
						</button>
						<button
							type="button"
							onClick={() => setUploadMode('excel')}
							className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
						>
							Upload Excel File
						</button>
					</div>
				)}

				{uploadMode === 'single' && (
				<div className="flex flex-col gap-3 md:flex-row">
					<input
						type="date"
						className="border border-gray-300 rounded px-3 py-2 text-sm"
						value={formDate}
						onChange={(e) => setFormDate(e.target.value)}
					/>
					<input
						type="number"
						step="any"
						className="border border-gray-300 rounded px-3 py-2 text-sm"
						value={formValue}
						onChange={(e) => setFormValue(e.target.value)}
						placeholder="Value"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => handleForcePlateSave(field)}
							className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
							disabled={isSubmitting}
						>
							{isSubmitting ? "Saving..." : "Save"}
						</button>
						<button
							type="button"
							onClick={closeForm}
							className="border border-white/40 text-white px-4 py-2 rounded-lg"
						>
							Cancel
						</button>
					</div>
				</div>
				)}

				{uploadMode === 'excel' && (
					<div className="flex flex-col gap-3">
						<input
							type="file"
							accept=".xlsx,.xls"
							onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
							className="border border-gray-300 rounded px-3 py-2 text-sm text-white"
							disabled={isUploading}
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => handleExcelUpload(field)}
								className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
								disabled={isUploading || !excelFile}
							>
								{isUploading ? "Uploading..." : "Upload"}
							</button>
							<button
								type="button"
								onClick={closeForm}
								className="border border-white/40 text-white px-4 py-2 rounded-lg"
								disabled={isUploading}
							>
								Cancel
							</button>
						</div>
						{uploadProgress && (
							<p className="text-sm text-yellow-300 mt-2">{uploadProgress}</p>
						)}
					</div>
				)}

				{formError && <p className="text-sm text-red-400 mt-2">{formError}</p>}
			</div>
		);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	const metricKeys = [
		"rsi_modified_meters_sec",
		"jump_height_cm",
		"concentric_impulse_asym_percent_L",
		"concentric_impulse_asym_percent_R",
		"eccentric_deceleration_impulse_asym_percent_L",
		"eccentric_deceleration_impulse_asym_percent_R",
		"landing_impulse_asym_percent_L",
		"landing_impulse_asym_percent_R",
	];
	const hasAnyData = metricKeys.some((k) => (keyCounts[k] || 0) > 0);

	return (
		<>
			<h1 className="text-2xl font-bold mb-8">
				{forcePlateData?.length > 0 && (
					<p>Force Plate Data for {forcePlateData[0].name}</p>
				)}
			</h1>

			{hasAnyData ? (
				<>
					{/* RSI Modified (full width) */}
					{keyCounts.rsi_modified_meters_sec > 0 ? (
						<section className="relative mb-8">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold">RSI Modified (m/s)</h2>
								<div className="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setActiveForm("rsi_modified_meters_sec");
											setActiveRemoveView(null);
											setUploadMode(null);
											setExcelFile(null);
										setFormDate("");
										setFormValue("");
										setFormError("");
									}}
									className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
								>
									Add Data
								</button>
									<button
										type="button"
										onClick={() => {
											setActiveRemoveView("rsi_modified_meters_sec");
											setActiveForm(null);
										}}
										className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
									>
										Remove Data
									</button>
								</div>
							</div>
							{renderForm("rsi_modified_meters_sec", "RSI Modified")}
							{renderRemoveView("rsi_modified_meters_sec", "RSI Modified")}
							<ResponsiveContainer width="100%" height={300}>
								<LineChart data={forcePlateData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis
										label={{ value: "RSI (m/s)", angle: -90, position: "insideLeft" }}
									/>
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="rsi_modified_meters_sec"
										stroke="#82ca9d"
										name="RSI Modified"
										connectNulls
									/>
								</LineChart>
							</ResponsiveContainer>
						</section>
					) : (
						<div className="bg-white/10 border border-[#FFBF00]/10 rounded-lg py-10 text-center text-gray-300 mb-8">
							No RSI Modified data available
						</div>
					)}
					{keyCounts.jump_height_cm > 0 ? (
						<section className="relative mb-8">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold">Jump Height (cm)</h2>
								<div className="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setActiveForm("jump_height_cm");
											setActiveRemoveView(null);
											setUploadMode(null);
											setExcelFile(null);
										setFormDate("");
										setFormValue("");
										setFormError("");
									}}
									className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
								>
									Add Data
								</button>
									<button
										type="button"
										onClick={() => {
											setActiveRemoveView("jump_height_cm");
											setActiveForm(null);
										}}
										className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
									>
										Remove Data
									</button>
								</div>
							</div>
							{renderForm("jump_height_cm", "Jump Height")}
							{renderRemoveView("jump_height_cm", "Jump Height")}
							<ResponsiveContainer width="100%" height={300}>
								<LineChart data={forcePlateData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis
										label={{
											value: "Jump Height (cm)",
											angle: -90,
											position: "insideLeft",
										}}
									/>
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="jump_height_cm"
										stroke="#8884d8"
										name="Jump Height"
										connectNulls
									/>
								</LineChart>
							</ResponsiveContainer>
						</section>
					) : (
						<div className="bg-white/10 border border-[#FFBF00]/10 rounded-lg py-10 text-center text-gray-300 mb-8">
							No Jump Height data available
						</div>
					)}
				</>
			) : (
				<div className="flex items-center justify-center py-12">
					<p className="text-gray-500 text-lg">No data available</p>
				</div>
			)}
		</>
	);
}

export default ForcePlate;
