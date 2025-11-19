import { useState, useEffect } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
} from "recharts";
import supabase from "../utils/supabase";
import Loader from "./Loader";

function ForcePlate({ id, onDataPresence }) {
	const [forcePlateData, setForcePlateData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [keyCounts, setKeyCounts] = useState({});

	useEffect(() => {
		async function getForcePlateData() {
			setLoading(true);
			const { data: baselineData, error: baselineError } = await supabase
				.from("ForcePlate_Baseline")
				.select("*")
				.eq("id", id);

			const { data: weeklyData, error: weeklyError } = await supabase
				.from("ForcePlate_Weekly")
				.select("*")
				.eq("id", id);

			if (baselineError || weeklyError) {
				console.error("Supabase error:", baselineError || weeklyError);
				setError((baselineError || weeklyError)?.message || "Unknown error");
            } else if (baselineData && weeklyData) {
				const combined = [...(baselineData || []), ...(weeklyData || [])];
				const sortedData = combined.sort(
					(a, b) => new Date(a.date) - new Date(b.date),
				);

				const keyCounts = {
					name: 0,
					date: 0,
					rsi_modified_meters_sec: 0,
					jump_height_cm: 0,
					concentric_impulse_asym_percent_L: 0,
					concentric_impulse_asym_percent_R: 0,
					eccentric_deceleration_impulse_asym_percent_L: 0,
					eccentric_deceleration_impulse_asym_percent_R: 0,
					landing_impulse_asym_percent_L: 0,
					landing_impulse_asym_percent_R: 0,
				};
				sortedData.forEach((item) => {
					Object.entries(item).forEach(([key, value]) => {
						if (value !== null && value !== undefined) {
							keyCounts[key] += 1;
						}
					});
				});

				setKeyCounts(keyCounts);
				setForcePlateData(sortedData);
                if (onDataPresence) {
                    const metricKeys = [
                        "rsi_modified_meters_sec",
                        "jump_height_cm",
                        "concentric_impulse_asym_percent_L",
                        "concentric_impulse_asym_percent_R",
                        "eccentric_deceleration_impulse_asym_percent_L",
                        "eccentric_deceleration_impulse_asym_percent_R",
                        "landing_impulse_asym_percent_L",
                        "landing_impulse_asym_percent_R",
                    ];
                    const hasAny = metricKeys.some((k) => (keyCounts[k] || 0) > 0);
                    onDataPresence(hasAny);
                }
			} else {
				console.error("Error getting force plate data:", error);
				setForcePlateData([]);
                if (onDataPresence) onDataPresence(false);
			}
			setLoading(false);
		}

		getForcePlateData();
	}, [id, onHasData]);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	const metricKeys = [
		"rsi_modified_meters_sec",
		"jump_height_cm",
		"concentric_impulse_asym_percent_L",
		"concentric_impulse_asym_percent_R",
		"eccentric_deceleration_impulse_asym_percent_L",
		"eccentric_deceleration_impulse_asym_percent_R",
		"landing_impulse_asym_percent_L",
		"landing_impulse_asym_percent_R",
	];
	const hasAnyData = metricKeys.some((k) => (keyCounts[k] || 0) > 0);

	return (
		<>
			<h1 className="text-2xl font-bold mb-8">
				{forcePlateData?.length > 0 && (
					<p>Force Plate Data for {forcePlateData[0].name}</p>
				)}
			</h1>

			{hasAnyData ? (
				<>
					{/* RSI Modified (full width) */}
					{keyCounts.rsi_modified_meters_sec > 0 && (
						<section className="relative mb-8">
							<h2 className="text-xl font-semibold mb-4">RSI Modified (m/s)</h2>
							<ResponsiveContainer width="100%" height={300}>
								<LineChart data={forcePlateData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis
										label={{ value: "RSI (m/s)", angle: -90, position: "insideLeft" }}
									/>
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="rsi_modified_meters_sec"
										stroke="#82ca9d"
										name="RSI Modified"
										connectNulls
									/>
								</LineChart>
							</ResponsiveContainer>
						</section>
					)}
			{keyCounts.jump_height_cm > 0 && (
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">Jump Height (cm)</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								label={{
									value: "Jump Height (cm)",
									angle: -90,
									position: "insideLeft",
								}}
							/>
							<Tooltip />
							<Legend />
							<Line
								type="monotone"
								dataKey="jump_height_cm"
								stroke="#8884d8"
								name="Jump Height"
								connectNulls
							/>
						</LineChart>
					</ResponsiveContainer>
				</section>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{keyCounts.concentric_impulse_asym_percent_L > 0 && (
					<section className="relative mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Concentric Impulse Asymmetry Left (%)
						</h2>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={forcePlateData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Asymmetry (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="concentric_impulse_asym_percent_L"
									stroke="#ff7300"
									name="Asymmetry %"
									connectNulls
								/>
							</LineChart>
						</ResponsiveContainer>
					</section>
				)}
				{keyCounts.concentric_impulse_asym_percent_R > 0 && (
					<section className="relative mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Concentric Impulse Asymmetry Right (%)
						</h2>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={forcePlateData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Asymmetry (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="concentric_impulse_asym_percent_R"
									stroke="#ff7300"
									name="Asymmetry %"
									connectNulls
								/>
							</LineChart>
						</ResponsiveContainer>
					</section>
				)}
				{keyCounts.eccentric_deceleration_impulse_asym_percent_L > 0 && (
					<section className="relative mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Eccentric Deceleration Impulse Asymmetry Left (%)
						</h2>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={forcePlateData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Asymmetry (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="eccentric_deceleration_impulse_asym_percent_L"
									stroke="#ff7300"
									name="Asymmetry %"
									connectNulls
								/>
							</LineChart>
						</ResponsiveContainer>
					</section>
				)}
				{keyCounts.eccentric_deceleration_impulse_asym_percent_R > 0 && (
					<section className="relative mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Eccentric Deceleration Impulse Asymmetry Right (%)
						</h2>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={forcePlateData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Asymmetry (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="eccentric_deceleration_impulse_asym_percent_R"
									stroke="#ff7300"
									name="Asymmetry %"
									connectNulls
								/>
							</LineChart>
						</ResponsiveContainer>
					</section>
				)}
				{keyCounts.landing_impulse_asym_percent_L > 0 && (
					<section className="relative mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Landing Impulse Asymmetry Left (%)
						</h2>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={forcePlateData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Asymmetry (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="landing_impulse_asym_percent_L"
									stroke="#ff7300"
									name="Asymmetry %"
									connectNulls
								/>
							</LineChart>
						</ResponsiveContainer>
					</section>
				)}
				{keyCounts.landing_impulse_asym_percent_R > 0 && (
					<section className="relative mb-8">
						<h2 className="text-xl font-semibold mb-4">
							Landing Impulse Asymmetry Right (%)
						</h2>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={forcePlateData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Asymmetry (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="landing_impulse_asym_percent_R"
									stroke="#ff7300"
									name="Asymmetry %"
									connectNulls
								/>
							</LineChart>
						</ResponsiveContainer>
					</section>
					)}
				</div>
				</>
			) : (
				<div className="flex items-center justify-center py-12">
					<p className="text-gray-500 text-lg">No data available</p>
				</div>
			)}
		</>
	);
}

export default ForcePlate;
