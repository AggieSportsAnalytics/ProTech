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
	const [comparisonAthletes, setComparisonAthletes] = useState([]);
	const [selectedComparisonId, setSelectedComparisonId] = useState(null);
	const [comparisonAthlete, setComparisonAthlete] = useState(null);
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

			const { data, error } = await supabase
				.from("Athlete_Data")
				.select("name, id")
				.eq("position", position)
				.neq("id", id); // exclude current athlete

			if (!error && data) {
				setComparisonAthletes(data);
				setSelectedComparisonId(data[0]?.id);
			}
			setLoading(false);
		};
		init();
	}, [id]);

	useEffect(() => {
		if (selectedComparisonId) {
			fetchAndSetAthlete(selectedComparisonId, setComparisonAthlete);
		}
	}, [selectedComparisonId]);

	const labels = [
		"Incline Bench",
		"Back Squat",
		"Hang Clean",
		"10-Yard Dash",
		"Flying 10",
		"40-Yard Dash",
	];

	const getNormalizedData = (athlete) => [
		relativeNormalize(
			parseNumber(athlete.inclineBench, " lbs"),
			averages.inclineBench,
		),
		relativeNormalize(
			parseNumber(athlete.backSquat, " lbs"),
			averages.backSquat,
		),
		relativeNormalize(
			parseNumber(athlete.hangClean, " lbs"),
			averages.hangClean,
		),
		relativeNormalize(parseNumber(athlete.tenYard, "s"), averages.tenYard, 2),
		relativeNormalize(
			parseNumber(athlete.flyingTen, "s"),
			averages.flyingTen,
			2,
		),
		relativeNormalize(
			parseNumber(athlete.fortyYard, "s"),
			averages.fortyYard,
			2,
		),
	];

	if (loading || !mainAthlete.name) return <Loader />;

	const data = {
		labels,
		datasets: [
			{
				label: mainAthlete.name,
				data: getNormalizedData(mainAthlete),
				backgroundColor: "rgba(255, 99, 132, 0.2)",
				borderColor: "rgb(255, 99, 132)",
				pointBackgroundColor: "rgb(255, 99, 132)",
				fill: true,
			},
			comparisonAthlete && {
				label: comparisonAthlete.name,
				data: getNormalizedData(comparisonAthlete),
				backgroundColor: "rgba(54, 162, 235, 0.2)",
				borderColor: "rgb(54, 162, 235)",
				pointBackgroundColor: "rgb(54, 162, 235)",
				fill: false,
			},
		].filter(Boolean),
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
		},
	};

	return (
		<div className="p-4 max-w-xl mx-auto">
			<h2 className="text-center text-xl font-semibold mb-4">
				Compare Athletes at {mainAthlete.position}
			</h2>

			<select
				value={selectedComparisonId || ""}
				onChange={(e) => setSelectedComparisonId(e.target.value)}
				className="w-full max-w-sm mx-auto block mb-6 p-2 border rounded"
			>
				{comparisonAthletes.map((player) => (
					<option key={player.id} value={player.id}>
						{player.name}
					</option>
				))}
			</select>

			<Radar data={data} options={options} />
		</div>
	);
};

export default AthleteComparisonChart;
