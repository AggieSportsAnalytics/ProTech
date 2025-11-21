import { useEffect, useState } from "react";
import { Radar } from "react-chartjs-2";
import supabase from "../utils/supabase";
import Loader from "./Loader";
import {
	Chart as ChartJS,
	RadialLinearScale,
	PointElement,
	LineElement,
	Filler,
	Tooltip,
	Legend,
} from "chart.js";

ChartJS.register(
	RadialLinearScale,
	PointElement,
	LineElement,
	Filler,
	Tooltip,
	Legend,
);

const normalize = (value, min, max) =>
	Math.min(10, Math.max(0, ((value - min) / (max - min)) * 10));

const parseNumber = (str, unit = "") => {
	if (!str && str !== 0) return 0;
	// Convert to string if it's not already
	const strValue = typeof str === 'string' ? str : String(str);
	// Handle "NT" (No Time) or other non-numeric values
	if (strValue === "NT" || strValue === "N/A" || strValue === "") return 0;
	return Number.parseFloat(strValue.replace(unit, "").replace(/["']/g, "").trim()) || 0;
};

const safeDivide = (value, avg) => (avg > 0 ? value / avg : 1);

const relativeNormalize = (value, avg, maxRatio = 2) => {
	const ratio = safeDivide(value, avg);
	return normalize(ratio, 0, maxRatio);
};

const AthleteComparisonChart = ({ id }) => {
	const [loading, setLoading] = useState(false);
	const [mainAthlete, setMainAthlete] = useState({});
	const [averages, setAverages] = useState({});

	function getLatestStats(stats) {
		const statKeys = [
			"lDrill",
			"tenYard",
			"backSquat",
			"broadJump",
			"flyingTen",
			"fortyYard",
			"hangClean",
			"bodyWeight",
			"proAgility",
			"inclineBench",
			"verticalJump",
		];

		const latestStats = {};

		// Sort by year descending so we prioritize newer entries
		const sorted = [...stats].sort((a, b) => b.year - a.year);

		for (const key of statKeys) {
			for (const entry of sorted) {
				const value = entry[key];
				if (value && value !== "NT") {
					latestStats[key] = value;
					break; // Stop once we find the most recent non-NT value
				}
			}
		}

		return latestStats;
	}

	const statKeys = [
		"inclineBench",
		"backSquat",
		"hangClean",
		"tenYard",
		"flyingTen",
		"fortyYard",
	];

	const fetchAndSetAthlete = async (athleteId, setter) => {
		const { data, error } = await supabase
			.from("Athlete_Data")
			.select("*")
			.eq("id", athleteId)
			.single();

		if (error) {
			console.error("Supabase error:", error);
			return;
		}

		const { stats, ...core } = data;
		const latest = getLatestStats(stats) || {};
		setter({ ...core, ...latest });
		return data.position;
	};

	const calcAverages = async (position) => {
		const { data: athletes, error } = await supabase
			.from("Athlete_Data")
			.select("stats")
			.eq("position", position);

		if (error || !athletes) return;

		const latestStats = athletes
			.map((a) => getLatestStats(a.stats) || {})
			.filter(Boolean);

		const result = {};
		for (const key of statKeys) {
			const values = latestStats
				.map((s) => {
					const value = s?.[key];
					// Handle different value types
					if (value === null || value === undefined) return null;
					return parseNumber(value);
				})
				.filter((v) => v !== null && !Number.isNaN(v) && v > 0);
			
			if (values.length > 0) {
				result[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
			} else {
				result[key] = 0;
			}
		}
		setAverages(result);
	};

	useEffect(() => {
		const init = async () => {
			if (!id) {
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const position = await fetchAndSetAthlete(id, setMainAthlete);
				if (position) {
					await calcAverages(position);
				}
			} catch (error) {
				console.error("Error initializing chart:", error);
			} finally {
				setLoading(false);
			}
		};
		init();
	}, [id]);

	const labels = [
		"Incline Bench",
		"Back Squat",
		"Hang Clean",
		"10-Yard Dash",
		"Flying 10",
		"40-Yard Dash",
	];

	const getNormalizedData = (athlete) => {
		// Store raw values for tooltips
		const rawValues = [
			parseNumber(athlete.inclineBench, " lbs"),
			parseNumber(athlete.backSquat, " lbs"),
			parseNumber(athlete.hangClean, " lbs"),
			parseNumber(athlete.tenYard, "s"),
			parseNumber(athlete.flyingTen, "s"),
			parseNumber(athlete.fortyYard, "s"),
		];

		// Store normalized values for display
		const normalizedValues = [
			relativeNormalize(rawValues[0], averages.inclineBench),
			relativeNormalize(rawValues[1], averages.backSquat),
			relativeNormalize(rawValues[2], averages.hangClean),
			relativeNormalize(rawValues[3], averages.tenYard, 2),
			relativeNormalize(rawValues[4], averages.flyingTen, 2),
			relativeNormalize(rawValues[5], averages.fortyYard, 2),
		];

		return { normalizedValues, rawValues };
	};

	if (!mainAthlete || !mainAthlete.name) {
		if (loading) {
			return (
				<div className="p-4 flex items-center justify-center min-h-[400px]">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B1340]"></div>
					<span className="ml-3 text-gray-500">Loading chart data...</span>
				</div>
			);
		}
		return (
			<div className="p-4 text-center text-gray-500">
				No athlete data available
			</div>
		);
	}

	const athleteData = getNormalizedData(mainAthlete);
	
	const data = {
		labels,
		datasets: [
			{
				label: mainAthlete.name,
				data: athleteData.normalizedValues,
				backgroundColor: "rgba(11, 19, 64, 0.2)",
				borderColor: "rgb(11, 19, 64)",
				pointBackgroundColor: "rgb(11, 19, 64)",
				fill: true,
				rawValues: athleteData.rawValues,
			},
			{
				label: "Position Average",
				data: [5, 5, 5, 5, 5, 5], // Center point on the 0-10 scale
				backgroundColor: "rgba(128, 128, 128, 0.2)",
				borderColor: "rgb(128, 128, 128)",
				pointBackgroundColor: "rgb(128, 128, 128)",
				fill: true,
				rawValues: Object.values(averages),
			},
		],
	};

	const options = {
		responsive: true,
		scales: {
			r: {
				beginAtZero: true,
				max: 10,
				ticks: { stepSize: 2 },
			},
		},
		plugins: {
			legend: { position: "top" },
			tooltip: {
				callbacks: {
					label: (context) => {
						const label = context.dataset.label;
						const rawValue = context.dataset.rawValues[context.dataIndex];
						const unit = context.dataIndex < 3 ? " lbs" : "s";
						return `${label}: ${rawValue.toFixed(2)}${unit}`;
					}
				}
			}
		},
	};

	return (
		<div className="p-4 max-w-xl mx-auto">
			{loading ? (
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B1340]"></div>
					<span className="ml-3 text-gray-500">Updating chart...</span>
				</div>
			) : (
				<Radar data={data} options={options} />
			)}
		</div>
	);
};

export default AthleteComparisonChart;
