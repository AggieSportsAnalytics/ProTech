import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import supabase from "../utils/supabase";

function AthleteCard({ athlete, setIsModalOpen, setSelectedType, setFormData }) {
	const availableYears = useMemo(
		() => athlete.stats.map((stat) => stat.year),
		[athlete],
	);
	const [imageUrls, setImageUrls] = useState([]);
	const [imageLoading, setImageLoading] = useState(true);

	useEffect(() => {
		const getImages = async () => {
			if (!athlete?.id || !availableYears) {
				return;
			}
			setImageLoading(true);
			try {
				const imageResults = await Promise.all(
					availableYears.map(async (year) => {
						// Try different image formats
						const formats = ['jpg', 'jpeg', 'png'];
						for (const format of formats) {
							const path = `${athlete.id}/${year}.${format}`;
							const { data: urlData } = supabase.storage
								.from("athlete-images")
								.getPublicUrl(path);
							
							// Check if image exists by trying to load it
							try {
								const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
								if (response.ok) {
									return { year, url: urlData.publicUrl };
								}
							} catch (error) {
								console.log(`Failed to load image for ${year} in ${format} format`);
							}
						}
						return { year, url: null }; // Return null if no format works
					})
				);

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
		<div className="bg-white">
			{/* Header Section */}
			<div className="flex justify-between items-start my-6">
				<div>
					<h2 className="text-3xl font-bold text-[#0B1340] mb-2">{athlete.name}</h2>
					<div className="flex gap-6 text-gray-600">
						<p><span className="font-medium">Position:</span> {athlete.position}</p>
						<p><span className="font-medium">Height:</span> {athlete.height}</p>
						<p><span className="font-medium">Wing:</span> {athlete.wing}</p>
						<p><span className="font-medium">Hand:</span> {athlete.hand}</p>
					</div>
				</div>
				<Link
					to={`/data/${athlete.id}`}
					className="bg-[#B4975A] hover:bg-[#8B7443] text-white px-4 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4975A] flex items-center"
				>
					<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</Link>
			</div>

			{/* Container for Images + Stats section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

			{/* Images Section */}
			<div className="overflow-x-auto">
				<h3 className="text-xl font-semibold text-[#0B1340] mb-4 text-center">Progress Photos</h3>
					{imageLoading ? (
						<div className="flex items-center justify-center h-[50vh]">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B1340]"></div>
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
				<div className="flex items-center justify-center h-[50vh] text-gray-500">
					No photos available
				</div>
				)}
			</div>

			{/* Right: Stats Section */}
			<div>
			<h3 className="text-xl font-semibold text-[#0B1340] mb-4 text-center">
				Performance Stats
			</h3>
			<div className="overflow-y-auto max-h-96">
				<table className="min-w-full divide-y divide-gray-200">
				<thead className="bg-gray-50">
					<tr>
					<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
						Stat
					</th>
					{athlete.stats.map((stat) => (
						<th
						key={stat.year}
						className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
						{stat.year}
						</th>
					))}
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
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
					<tr key={key} className="hover:bg-gray-50">
						<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{label}</td>
						{athlete.stats.map((stat) => (
						<td key={stat.year + key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
							{stat[key]}
						</td>
						))}
					</tr>
					))}
				</tbody>
				</table>
			</div>
			</div>
		</div>
		</div>
	);
}

export default AthleteCard;
