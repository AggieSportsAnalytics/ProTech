import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../utils/supabase";

function AthleteCard({ athlete }) {
	const navigate = useNavigate();
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
				<div className="flex flex-col items-end gap-2">
					<div
						className="text-sm text-gray-500 cursor-pointer hover:text-[#B4975A]"
						onClick={(e) => {
							e.stopPropagation();
							navigator.clipboard.writeText(athlete.id);
							setCopied(true);
							setTimeout(() => setCopied(false), 1000);
						}}
					>
						{!copied ? <p>ID: {athlete.id}</p> : <p>Copied!</p>}
					</div>
					<button
						onClick={(e) => {
							e.stopPropagation();
							navigate(`/data/${athlete.id}`);
						}}
						className="px-4 py-2 rounded-md text-white bg-[#0B1340] hover:bg-[#0b1340cc] text-sm"
					>
						View Data
					</button>
				</div>
			</div>

			{/* Images Section */}
			<div className="mb-8 overflow-x-auto">
				<h3 className="text-xl font-semibold text-[#0B1340] mb-4">Progress Photos</h3>
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
									className="h-[50vh] w-auto"
									loading="lazy"
									onError={(e) => {
										e.target.onerror = null;
										e.target.src = '/aggie.png'; // fallback image
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

			{/* Stats Section */}
			<div>
				<h3 className="text-xl font-semibold text-[#0B1340] mb-4">Performance Stats</h3>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Body Weight</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vertical Jump</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broad Jump</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">10-Yard Dash</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flying 10</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">40-Yard Dash</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pro Agility</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L-Drill</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hang Clean</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Back Squat</th>
								<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incline Bench</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{athlete.stats.map((stat) => (
								<tr key={stat.year} className="hover:bg-gray-50">
									<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.year}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.bodyWeight}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.verticalJump}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.broadJump}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.tenYard}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.flyingTen}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.fortyYard}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.proAgility}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.lDrill}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.hangClean}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.backSquat}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.inclineBench}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

export default AthleteCard;
