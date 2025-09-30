import { useState, useEffect, useMemo } from "react";
import supabase from "../utils/supabase";

function AthleteCard({ athlete }) {
	const availableYears = useMemo(
		() => athlete.stats.map((stat) => stat.year),
		[athlete],
	);
	const [imageUrls, setImageUrls] = useState([]);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		const getImages = async () => {
			if (!athlete?.id || !availableYears) {
				return;
			}
			try {
				const urls = await Promise.all(
					availableYears.map(async (year) => {
						const { data } = supabase.storage
							.from("athlete-images")
							.getPublicUrl(`${athlete.id}/${year}.jpg`);
						return data.publicUrl;
					})
				);
				setImageUrls(urls);
			} catch (error) {
				console.error(error);
			}
		};

		getImages();
	}, [athlete]);

	return (
		<div className="athlete-card">
			<h3>{athlete.name}</h3>
			<div
				className="text-xs text-gray-500"
				onClick={(e) => {
					e.stopPropagation();
					navigator.clipboard.writeText(athlete.id);
					setCopied(true);
					setTimeout(() => {
						setCopied(false);
					}, 1000);
				}}
			>
				{!copied ? <p>Click to Copy ID: {athlete.id}</p> : <p>Copied!</p>}
			</div>
			<p>Position: {athlete.position}</p>
			<p>Height: {athlete.height}</p>
			<p>Wing: {athlete.wing}</p>
			<p>Hand: {athlete.hand}</p>

			{/* Image carousel or grid */}
			<div className="athlete-images">
				{imageUrls.map((image, index) => (
					<div key={index} className="image-container">
						<img
							src={image}
							alt={athlete.name}
							className="athlete-image"
							loading="lazy"
						/>
						<p className="image-year">{availableYears[index]}</p>
					</div>
				))}
			</div>

			{/* Stats table */}
			<table className="stats-table">
				<thead>
					<tr>
						<th>Year</th>
						<th>Body Weight</th>
						<th>Vertical Jump</th>
						<th>Broad Jump</th>
						<th>10-Yard Dash</th>
						<th>Flying 10</th>
						<th>40-Yard Dash</th>
						<th>Pro Agility</th>
						<th>L-Drill</th>
						<th>Hang Clean</th>
						<th>Back Squat</th>
						<th>Incline Bench</th>
					</tr>
				</thead>
				<tbody>
					{athlete.stats.map((stat) => (
						<tr key={stat.year}>
							<td>{stat.year}</td>
							<td>{stat.bodyWeight}</td>
							<td>{stat.verticalJump}</td>
							<td>{stat.broadJump}</td>
							<td>{stat.tenYard}</td>
							<td>{stat.flyingTen}</td>
							<td>{stat.fortyYard}</td>
							<td>{stat.proAgility}</td>
							<td>{stat.lDrill}</td>
							<td>{stat.hangClean}</td>
							<td>{stat.backSquat}</td>
							<td>{stat.inclineBench}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default AthleteCard;
