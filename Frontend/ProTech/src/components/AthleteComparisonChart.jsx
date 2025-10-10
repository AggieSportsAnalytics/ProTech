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
	if (!str) return 0;
	return Number.parseFloat(str.replace(unit, "").replace(/["']/g, "").trim());
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
				.map((s) => parseNumber(s?.[key]))
				.filter((v) => !Number.isNaN(v));
			result[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
		}
		setAverages(result);
	};

	useEffect(() => {
		const init = async () => {
			setLoading(true);
			const position = await fetchAndSetAthlete(id, setMainAthlete);
			await calcAverages(position);

			setLoading(false);
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

	if (loading || !mainAthlete.name) return <Loader />;

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
			<Radar data={data} options={options} />
		</div>
	);
};

export default AthleteComparisonChart;
