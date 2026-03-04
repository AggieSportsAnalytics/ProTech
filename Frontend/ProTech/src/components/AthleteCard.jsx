import { useState, useEffect, useMemo } from "react";
import supabase from "../utils/supabase";
import { formatNameFirstLast } from "../utils/nameFormat";

function AthleteCard({ athlete, setIsModalOpen, setSelectedType, setFormData }) {
	if (!athlete) {
		return <div className="p-8 text-gray-500">No athlete data available</div>;
	}

	const availableYears = useMemo(
		() => {
			if (!athlete?.stats || !Array.isArray(athlete.stats)) {
				return [];
			}
			// Get unique years, then sort in ascending order (oldest first, newest last)
			const uniqueYears = [...new Set(athlete.stats
				.map((stat) => stat?.year)
				.filter(Boolean))];
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
				if (!stat?.year) return;
				const year = stat.year;
				const existing = statsByYear.get(year);
				
				// If no existing entry for this year, or if this stat has more data, use it
				if (!existing) {
					statsByYear.set(year, stat);
				} else {
					// Keep the one with more non-null values, or prefer the existing one
					const existingNonNull = Object.values(existing).filter(v => v !== null && v !== undefined).length;
					const currentNonNull = Object.values(stat).filter(v => v !== null && v !== undefined).length;
					if (currentNonNull > existingNonNull) {
						statsByYear.set(year, stat);
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
					const sanitizedName = nameData.name.replace(/[<>:"/\\|?*]/g, '-').trim();
					const constructedFolder = `${sanitizedName}-${athlete.id}`;
					
					// Verify the folder exists by trying to list it
					const { data: testFiles } = await supabase.storage
						.from("athlete-images")
						.list(constructedFolder, { limit: 1 });
					
					if (testFiles !== null) {
						athleteFolder = constructedFolder;
					}
				}
				
				// Fallback: search for folder ending with UUID if constructed name didn't work
				if (!athleteFolder) {
					const { data: allFolders } = await supabase.storage
						.from("athlete-images")
						.list("", { limit: 1000 });

					for (const item of allFolders || []) {
						const { data: folderContents } = await supabase.storage
							.from("athlete-images")
							.list(item.name, { limit: 1 });
						
						if (folderContents !== null && (item.name.endsWith(`-${athlete.id}`) || item.name === athlete.id)) {
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
				files?.forEach(file => {
					const fileName = file.name;
					// First 4 digits followed by non-digit or end of string (ignore " (1)" etc.)
					const yearMatch = fileName.match(/^(\d{4})(?:\D|$)/);
					if (yearMatch) {
						const year = parseInt(yearMatch[1], 10);
						if (!isNaN(year)) {
							yearsFromImages.add(year);
						}
					}
				});

				// Combine years from stats and years from image filenames
				// Use availableYears if it exists, otherwise just use years from images
				const statsYears = availableYears && availableYears.length > 0 ? availableYears : [];
				const allYears = new Set([...statsYears, ...yearsFromImages]);
				const sortedAllYears = Array.from(allYears).sort((a, b) => a - b);

				// Match files to years and build URLs
				// Use first 4 digits of filename as year (e.g. "2025 (1).jpg" -> 2025)
				const usedFiles = new Set();
				const imageResults = sortedAllYears.map((year) => {
					const yearStr = String(year);
					
					const matchingFile = files?.find(file => {
						if (usedFiles.has(file.name)) return false;
						
						const fileName = file.name;
						// Extract year from filename: first 4 digits only (ignore " (1)", etc.)
						const fileYearMatch = fileName.match(/^(\d{4})(?:\D|$)/);
						if (!fileYearMatch) return false;
						
						const fileYear = parseInt(fileYearMatch[1], 10);
						return fileYear === year;
					});

					if (matchingFile) {
						// Mark file as used to prevent duplicates
						usedFiles.add(matchingFile.name);
						
						const { data: urlData } = supabase.storage
							.from("athlete-images")
							.getPublicUrl(`${athleteFolder}/${matchingFile.name}`);
						
						return { year, url: urlData.publicUrl };
					}
					
					return { year, url: null };
				});

				// Filter out failed images, sort by year (ascending - oldest first), and set URLs
				const validUrls = imageResults
					.filter(result => result.url !== null)
					.sort((a, b) => a.year - b.year); // Sort by year ascending (oldest first)
				
				setImageUrls(validUrls);
			} catch (error) {
				setImageUrls([]);
			} finally {
				setImageLoading(false);
			}
		};

		getImages();
	}, [athlete, availableYears]);

	return (
		<div className="bg-white/5 border border-[#FFBF00]/20 rounded-lg p-6">
			{/* Header Section */}
			<div className="my-6">
				<div>
					<h2 className="text-3xl font-bold text-white mb-2">{formatNameFirstLast(athlete.name)}</h2>
					<div className="flex gap-6 text-gray-300">
						<p><span className="font-medium text-[#FFBF00]">Position:</span> {athlete.position}</p>
						<p><span className="font-medium text-[#FFBF00]">Height:</span> {athlete.height}</p>
						<p><span className="font-medium text-[#FFBF00]">Wing:</span> {athlete.wing}</p>
						<p><span className="font-medium text-[#FFBF00]">Hand:</span> {athlete.hand}</p>
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
