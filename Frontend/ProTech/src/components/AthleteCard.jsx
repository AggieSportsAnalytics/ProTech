import React, { useState, useEffect } from "react";

function AthleteCard({ athlete }) {
	const availableYears = athlete.stats.map((stat) => stat.year); // Extract years from stats
	const [imageUrls, setImageUrls] = useState([]);

	useEffect(() => {
		const getImages = async () => {
			if (!athlete?.name) {
				return;
			}
			try {
				const availableYears = athlete.stats.map((stat) => stat.year);
				const [firstName, lastName] = athlete.name.trim().split(/\s+/);
				const normalizedFirstLast = `${firstName}_${lastName}`.toLowerCase();
				const normalizedLast = lastName.toLowerCase();

				const tryUrl = async (baseName, year) => {
					const url = `${import.meta.env.VITE_S3_BUCKET_URL}/${baseName}${year}.jpg`;
					try {
						const res = await fetch(url, { method: "HEAD" }); // HEAD = just check if file exists
						if (res.ok) {
							return url;
						}
					} catch (err) {
						console.error("Fetch error:", err);
					}
					return null;
				};

				const urls = await Promise.all(
					availableYears.map(async (year) => {
						let url = await tryUrl(normalizedFirstLast, year);
						if (!url) {
							url = await tryUrl(normalizedLast, year);
						}
						return url;
					}),
				);

				setImageUrls(urls.filter(Boolean));
			} catch (error) {
				console.error(error);
			}
		};

		getImages();
	}, [athlete]);

	return (
		<div className="athlete-card">
			<h3>{athlete.name}</h3>
			<p>Position: {athlete.position}</p>
			<p>Height: {athlete.height}</p>
			<p>Wing: {athlete.wing}</p>
			<p>Hand: {athlete.hand}</p>

			{/* Image carousel or grid */}
			<div className="athlete-images">
				{imageUrls.map((image, index) => (
					<div key={index} className="image-container">
						<img src={image} alt={athlete.name} className="athlete-image" />
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
