import { useState, useEffect, useMemo, useRef } from "react";
import supabase from "../utils/supabase";
import { formatNameFirstLast } from "../utils/nameFormat";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Archived replaces; do not use as the primary image for a year. */
function isArchivePhotoName(fileName) {
	return /^old\d{4}/i.test(fileName);
}

/** Coerce DB/UI year (number or string) to an integer so Set/Map dedupe works. */
function normalizeYear(y) {
	if (y == null || y === "") return null;
	const n = typeof y === "number" && Number.isFinite(y) ? Math.trunc(y) : parseInt(String(y).trim(), 10);
	return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

/** Prefer `{year}.jpg` over loose first-4-digits match; never pick `old{year}.jpg` for display. */
function pickFileForYear(files, year) {
	if (!files?.length) return null;
	const exact = `${year}.jpg`;
	const canonical = files.find((f) => f.name === exact);
	if (canonical) return canonical;
	return files.find((f) => {
		if (isArchivePhotoName(f.name)) return false;
		const m = f.name.match(/^(\d{4})(?:\D|$)/);
		return m && parseInt(m[1], 10) === year;
	});
}

function AthleteCard({ athlete, setIsModalOpen, setSelectedType, setFormData }) {
	if (!athlete) {
		return <div className="p-8 text-gray-500">No athlete data available</div>;
	}

	const availableYears = useMemo(
		() => {
			if (!athlete?.stats || !Array.isArray(athlete.stats)) {
				return [];
			}
			// Get unique years (normalize so 2024 and "2024" are one year), oldest first
			const uniqueYears = [
				...new Set(
					athlete.stats
						.map((stat) => normalizeYear(stat?.year))
						.filter((y) => y != null),
				),
			];
			return uniqueYears.sort((a, b) => a - b);
		},
		[athlete],
	);
	const sortedStats = useMemo(
		() => {
			if (!athlete?.stats || !Array.isArray(athlete.stats)) {
				return [];
			}
			// Deduplicate stats by year - keep the most recent entry for each year
			// First, create a map to track the latest stat for each year
			const statsByYear = new Map();
			
			athlete.stats.forEach((stat) => {
				const year = normalizeYear(stat?.year);
				if (year == null) return;
				const existing = statsByYear.get(year);
				const row = { ...stat, year };
				
				// If no existing entry for this year, or if this stat has more data, use it
				if (!existing) {
					statsByYear.set(year, row);
				} else {
					// Keep the one with more non-null values, or prefer the existing one
					const existingNonNull = Object.values(existing).filter(v => v !== null && v !== undefined).length;
					const currentNonNull = Object.values(row).filter(v => v !== null && v !== undefined).length;
					if (currentNonNull > existingNonNull) {
						statsByYear.set(year, row);
					}
				}
			});
			
			// Convert map to array and sort by year in ascending order (oldest first, newest last)
			return Array.from(statsByYear.values()).sort((a, b) => {
				const yearA = a?.year || 0;
				const yearB = b?.year || 0;
				return yearA - yearB;
			});
		},
		[athlete],
	);
	const [imageUrls, setImageUrls] = useState([]);
	const [imageLoading, setImageLoading] = useState(false);
	const [uploadYear, setUploadYear] = useState(() => new Date().getFullYear());
	const [uploadBusy, setUploadBusy] = useState(false);
	const [imageRefreshKey, setImageRefreshKey] = useState(0);
	const [uploadOpen, setUploadOpen] = useState(false);
	const uploadPopoverRef = useRef(null);

	const handlePhotoUpload = async (e) => {
		e.preventDefault();
		if (uploadBusy) return;

		const form = e.currentTarget;
		const input = form.elements.photo;
		const file = input?.files?.[0];
		if (!file) {
			window.alert("Choose an image file.");
			return;
		}

		setUploadBusy(true);
		const UPLOAD_TIMEOUT_MS = 180000;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

		const formData = new FormData();
		formData.append("photo", file);
		formData.append("athleteId", athlete.id);
		formData.append("year", String(uploadYear));

		try {
			const res = await fetch(`${API_BASE}/api/athlete-photo`, {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				window.alert(data.message || "Upload failed");
				return;
			}
			window.alert("Photo uploaded successfully.");
			setImageRefreshKey((k) => k + 1);
			form.reset();
			setUploadOpen(false);
		} catch (err) {
			console.error(err);
			if (err?.name === "AbortError") {
				window.alert(
					"Upload timed out (server may be waking up or still processing). Wait a minute and try again.",
				);
			} else {
				window.alert(err?.message || "Upload failed");
			}
		} finally {
			clearTimeout(timeoutId);
			setUploadBusy(false);
		}
	};

	useEffect(() => {
		const getImages = async () => {
			if (!athlete?.id) {
				setImageUrls([]);
				setImageLoading(false);
				return;
			}
			// Don't clear existing images immediately - show them while loading new ones
			setImageLoading(true);
			try {
				// Get the athlete's name from names database to construct folder name
				// Folders are now in "Player Name-UUID" format
				const { data: nameData, error: nameError } = await supabase
					.from("names")
					.select("name")
					.eq("id", athlete.id)
					.single();

				let athleteFolder = null;
				
				// First, try to construct folder name from database
				if (!nameError && nameData) {
					const sanitizedName = nameData.name.replace(/[<>:"/\\|?*]/g, "-").trim();
					athleteFolder = `${sanitizedName}-${athlete.id}`;
				}

				if (!athleteFolder) {
					const { data: allFolders } = await supabase.storage
						.from("athlete-images")
						.list("", { limit: 1000 });

					for (const item of allFolders || []) {
						const { data: folderContents } = await supabase.storage
							.from("athlete-images")
							.list(item.name, { limit: 1 });

						if (
							folderContents !== null &&
							(item.name.endsWith(`-${athlete.id}`) || item.name === athlete.id)
						) {
							athleteFolder = item.name;
							break;
						}
					}
				}

				if (!athleteFolder) {
					setImageUrls([]);
					setImageLoading(false);
					return;
				}

				// List all files in the athlete's folder
				const { data: files, error } = await supabase.storage
					.from("athlete-images")
					.list(athleteFolder, {
						limit: 100,
						offset: 0,
					});

				if (error) {
					setImageUrls([]);
					setImageLoading(false);
					return;
				}

				// Extract years from image filenames using first 4 digits only
				// e.g. "2025.jpg", "2025 (1).jpg", "2025_something.jpg" -> 2025
				const yearsFromImages = new Set();
				files?.forEach((file) => {
					if (isArchivePhotoName(file.name)) return;
					const fileName = file.name;
					const yearMatch = fileName.match(/^(\d{4})(?:\D|$)/);
					if (yearMatch) {
						const y = parseInt(yearMatch[1], 10);
						if (!isNaN(y)) {
							yearsFromImages.add(y);
						}
					}
				});

				// Combine years from stats and years from image filenames
				// Use availableYears if it exists, otherwise just use years from images
				const statsYears = availableYears && availableYears.length > 0 ? availableYears : [];
				const allYears = new Set([...statsYears, ...yearsFromImages]);
				const sortedAllYears = Array.from(allYears).sort((a, b) => a - b);

				// Match files to years (prefer YYYY.jpg; ignore oldYYYY.jpg — see pickFileForYear)
				const imageResults = sortedAllYears.map((year) => {
					const y = normalizeYear(year);
					if (y == null) return { year: null, url: null };
					const matchingFile = pickFileForYear(files, y);

					if (matchingFile) {
						const { data: urlData } = supabase.storage
							.from("athlete-images")
							.getPublicUrl(`${athleteFolder}/${matchingFile.name}`);

						return { year: y, url: urlData.publicUrl };
					}

					return { year: y, url: null };
				});

				// One slot per calendar year (defensive: same URL twice if years were mixed types)
				const byYear = new Map();
				for (const result of imageResults) {
					if (result.url == null || result.year == null) continue;
					if (!byYear.has(result.year)) byYear.set(result.year, result);
				}
				const validUrls = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
				
				setImageUrls(validUrls);
			} catch (error) {
				setImageUrls([]);
			} finally {
				setImageLoading(false);
			}
		};

		getImages();
	}, [athlete, availableYears, imageRefreshKey]);

	useEffect(() => {
		if (!uploadOpen) return;
		const onKey = (ev) => {
			if (ev.key === "Escape") setUploadOpen(false);
		};
		const onPointer = (ev) => {
			const el = uploadPopoverRef.current;
			if (el && !el.contains(ev.target)) setUploadOpen(false);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointer, true);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointer, true);
		};
	}, [uploadOpen]);

	return (
		<div className="bg-white/5 border border-[#FFBF00]/20 rounded-lg p-6">
			{/* Header Section */}
			<div className="my-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 flex-1">
						<h2 className="text-3xl font-bold text-white mb-2">{formatNameFirstLast(athlete.name)}</h2>
						<div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-300">
							<p><span className="font-medium text-[#FFBF00]">Position:</span> {athlete.position}</p>
							<p><span className="font-medium text-[#FFBF00]">Height:</span> {athlete.height}</p>
							<p><span className="font-medium text-[#FFBF00]">Wing:</span> {athlete.wing}</p>
							<p><span className="font-medium text-[#FFBF00]">Hand:</span> {athlete.hand}</p>
						</div>
					</div>
					<div ref={uploadPopoverRef} className="relative shrink-0 sm:pt-1">
						<button
							type="button"
							onClick={() => setUploadOpen((o) => !o)}
							aria-expanded={uploadOpen}
							aria-haspopup="dialog"
							className="px-4 py-2 rounded bg-[#FFBF00] text-[#022851] font-medium hover:opacity-95"
						>
							Upload & crop
						</button>
						{uploadOpen && (
							<div
								className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-lg border border-[#FFBF00]/30 bg-[#071528] p-4 shadow-xl"
								role="dialog"
								aria-label="Upload progress photo"
							>
								<form onSubmit={handlePhotoUpload} className="flex flex-col gap-4">
									<label className="text-gray-300 text-sm flex flex-col gap-1">
										Year
										<input
											type="number"
											value={uploadYear}
											min={2000}
											max={2100}
											onChange={(e) => setUploadYear(Number(e.target.value))}
											className="bg-white/10 border border-[#FFBF00]/40 rounded px-3 py-2 text-white"
										/>
									</label>
									<label className="text-gray-300 text-sm flex flex-col gap-1">
										Photo
										<input
											type="file"
											name="photo"
											accept="image/*"
											className="text-sm text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-[#FFBF00]/20 file:px-3 file:py-1.5 file:text-[#FFBF00]"
										/>
									</label>
									<button
										type="submit"
										disabled={uploadBusy}
										className="self-center px-6 py-2 rounded bg-[#FFBF00] text-[#022851] font-medium disabled:opacity-50"
									>
										{uploadBusy ? "Uploading…" : "Upload & crop"}
									</button>
								</form>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Container for Images + Stats section */}
			<div className="flex flex-col items-center gap-8 mb-8">

			{/* Images Section */}
			<div className="w-full overflow-x-auto">
				<h3 className="text-xl font-semibold text-[#FFBF00] mb-4 text-center">Progress Photos</h3>
					{imageLoading ? (
						<div className="flex items-center justify-center h-[50vh]">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFBF00]"></div>
							<span className="ml-3 text-gray-300">Loading images...</span>
						</div>
					) : imageUrls.length > 0 ? (
				<div className={`flex space-x-6 pb-4 ${imageUrls.length <= 3 ? 'justify-center' : 'justify-start'}`}>
					{imageUrls.map((imageData, index) => (
					<div key={index} className="relative flex-shrink-0 rounded-lg shadow-md">
						<img
						src={imageData.url}
						alt={`${formatNameFirstLast(athlete.name)} - ${imageData.year}`}
						className="h-[80vh] w-auto"
						loading="lazy"
						onError={(e) => {
							e.target.onerror = null;
							e.target.src = '/aggie.png';
						}}
						/>
						<div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white py-2 px-3">
						<p className="text-sm font-medium">{imageData.year}</p>
						</div>
					</div>
					))}
				</div>
				) : (
				<div className="flex items-center justify-center h-[50vh] text-gray-400">
					No photos available
				</div>
				)}
			</div>

			{/* Stats Section - Below Images */}
			<div className="w-full flex flex-col items-center">
			<h3 className="text-xl font-semibold text-[#FFBF00] mb-4 text-center">
				Performance Stats
			</h3>
			<div className="overflow-y-auto max-h-96 w-full flex justify-center">
				<div className="w-full max-w-4xl">
				<table className="min-w-full divide-y divide-[#FFBF00]/20">
				<thead className="bg-[#FFBF00]/10">
					<tr>
					<th className="px-6 py-3 text-left text-xs font-medium text-[#FFBF00] uppercase tracking-wider">
						Stat
					</th>
					{sortedStats && Array.isArray(sortedStats) && sortedStats.length > 0 ? (
						sortedStats.map((stat, index) => (
							<th
							key={`${athlete?.id}-${stat?.year}-${index}`}
							className="px-6 py-3 text-left text-xs font-medium text-[#FFBF00] uppercase tracking-wider"
							>
							{stat?.year || 'N/A'}
							</th>
						))
					) : (
						<th className="px-6 py-3 text-left text-xs font-medium text-[#FFBF00] uppercase tracking-wider">
							No Data
						</th>
					)}
					</tr>
				</thead>
				<tbody className="bg-white/5 divide-y divide-[#FFBF00]/20">
					{[
					["Body Weight", "bodyWeight"],
					["Vertical Jump", "verticalJump"],
					["Broad Jump", "broadJump"],
					["10-Yard Dash", "tenYard"],
					["Flying 10", "flyingTen"],
					["40-Yard Dash", "fortyYard"],
					["Pro Agility", "proAgility"],
					["L-Drill", "lDrill"],
					["Hang Clean", "hangClean"],
					["Back Squat", "backSquat"],
					["Incline Bench", "inclineBench"],
					].map(([label, key]) => (
					<tr key={key} className="hover:bg-[#FFBF00]/10">
						<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{label}</td>
						{sortedStats && Array.isArray(sortedStats) && sortedStats.length > 0 ? (
							sortedStats.map((stat, statIndex) => (
							<td key={`${athlete?.id}-${stat?.year}-${key}-${statIndex}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
								{stat?.[key] || "-"}
							</td>
							))
						) : (
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">-</td>
						)}
					</tr>
					))}
				</tbody>
				</table>
				</div>
			</div>
			</div>
		</div>
		</div>
	);
}

export default AthleteCard;
