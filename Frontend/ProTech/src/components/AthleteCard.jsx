import { useState, useEffect, useMemo } from "react";
import supabase from "../utils/supabase";

function AthleteCard({ athlete, setIsModalOpen, setSelectedType, setFormData }) {
	if (!athlete) {
		return <div className="p-8 text-gray-500">No athlete data available</div>;
	}

	const availableYears = useMemo(
		() => {
			if (!athlete?.stats || !Array.isArray(athlete.stats)) {
				return [];
			}
			return athlete.stats.map((stat) => stat?.year).filter(Boolean);
		},
		[athlete],
	);
	const [imageUrls, setImageUrls] = useState([]);
	const [imageLoading, setImageLoading] = useState(false);

	useEffect(() => {
		const getImages = async () => {
			if (!athlete?.id || !availableYears || availableYears.length === 0) {
				setImageUrls([]);
				setImageLoading(false);
				return;
			}
			// Don't clear existing images immediately - show them while loading new ones
			setImageLoading(true);
			try {
				// List all files in the athlete's folder
				const { data: files, error } = await supabase.storage
					.from("athlete-images")
					.list(`${athlete.id}`, {
						limit: 100,
						offset: 0,
					});

				if (error) {
					console.log('Error listing images:', error);
					setImageUrls([]);
					setImageLoading(false);
					return;
				}

				// Match files to years and build URLs
				const imageResults = availableYears.map((year) => {
					// Find matching file for this year
					const matchingFile = files?.find(file => {
						const fileName = file.name.toLowerCase();
						return fileName.startsWith(`${year}.`) || fileName.startsWith(`${year}_`);
					});

					if (matchingFile) {
						const { data: urlData } = supabase.storage
							.from("athlete-images")
							.getPublicUrl(`${athlete.id}/${matchingFile.name}`);
						return { year, url: urlData.publicUrl };
					}
					return { year, url: null };
				});

				// Filter out failed images and set URLs
				const validUrls = imageResults
					.filter(result => result.url !== null)
					.map(result => result.url);
				
				setImageUrls(validUrls);
			} catch (error) {
				console.error('Error fetching images:', error);
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
					<h2 className="text-3xl font-bold text-white mb-2">{athlete.name}</h2>
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
				<div className="flex space-x-6 pb-4 justify-center">
					{imageUrls.map((image, index) => (
					<div key={index} className="relative flex-shrink-0 rounded-lg shadow-md">
						<img
						src={image}
						alt={`${athlete.name} - ${availableYears[index]}`}
						className="h-[60vh] w-auto"
						loading="lazy"
						onError={(e) => {
							e.target.onerror = null;
							e.target.src = '/aggie.png';
						}}
						/>
						<div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white py-2 px-3">
						<p className="text-sm font-medium">{availableYears[index]}</p>
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
					{athlete.stats && Array.isArray(athlete.stats) && athlete.stats.length > 0 ? (
						athlete.stats.map((stat) => (
							<th
							key={stat?.year}
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
						{athlete.stats && Array.isArray(athlete.stats) && athlete.stats.length > 0 ? (
							athlete.stats.map((stat) => (
							<td key={stat?.year + key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
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
