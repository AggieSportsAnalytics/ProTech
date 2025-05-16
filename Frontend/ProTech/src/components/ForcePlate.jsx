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

function ForcePlate({ id }) {
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
			} else {
				console.error("Error getting force plate data:", error);
				setForcePlateData([]);
			}
			setLoading(false);
		}

		getForcePlateData();
	}, [id]);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	return (
		<>
			<h1 className="text-2xl font-bold mb-8">
				Force Plate Data for {forcePlateData[0].name}
			</h1>

			{/* RSI Modified (full width) */}
			<section className="relative mb-8">
				<h2 className="text-xl font-semibold mb-4">RSI Modified (m/s)</h2>

				{keyCounts.rsi_modified_meters_sec === 0 && (
					<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
						<span className="text-gray-500 text-xl font-semibold">No Data</span>
					</div>
				)}
				<ResponsiveContainer width="100%" height={300}>
					<LineChart data={forcePlateData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="date" />
						<YAxis
							domain={keyCounts.rsi_modified_meters_sec === 0 ? [0, 1] : null}
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
			<section className="relative mb-8">
				<h2 className="text-xl font-semibold mb-4">Jump Height (cm)</h2>

				{keyCounts.jump_height_cm === 0 && (
					<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
						<span className="text-gray-500 text-xl font-semibold">No Data</span>
					</div>
				)}
				<ResponsiveContainer width="100%" height={300}>
					<LineChart data={forcePlateData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="date" />
						<YAxis
							domain={keyCounts.jump_height_cm === 0 ? [0, 150] : null}
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

			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Concentric Impulse Asymmetry Left (%)
					</h2>

					{keyCounts.concentric_impulse_asym_percent_L === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
							<span className="text-gray-500 text-xl font-semibold">
								No Data
							</span>
						</div>
					)}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={
									keyCounts.concentric_impulse_asym_percent_L === 0
										? [-10, 50]
										: null
								}
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
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Concentric Impulse Asymmetry Right (%)
					</h2>

					{keyCounts.concentric_impulse_asym_percent_R === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
							<span className="text-gray-500 text-xl font-semibold">
								No Data
							</span>
						</div>
					)}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={
									keyCounts.concentric_impulse_asym_percent_R === 0
										? [-10, 50]
										: null
								}
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
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Eccentric Deceleration Impulse Asymmetry Left (%)
					</h2>

					{keyCounts.eccentric_deceleration_impulse_asym_percent_L === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
							<span className="text-gray-500 text-xl font-semibold">
								No Data
							</span>
						</div>
					)}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={
									keyCounts.eccentric_deceleration_impulse_asym_percent_L === 0
										? [-10, 50]
										: null
								}
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
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Eccentric Deceleration Impulse Asymmetry Right (%)
					</h2>

					{keyCounts.eccentric_deceleration_impulse_asym_percent_R === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
							<span className="text-gray-500 text-xl font-semibold">
								No Data
							</span>
						</div>
					)}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={
									keyCounts.eccentric_deceleration_impulse_asym_percent_R === 0
										? [-10, 50]
										: null
								}
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
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Landing Impulse Asymmetry Left (%)
					</h2>

					{keyCounts.landing_impulse_asym_percent_L === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
							<span className="text-gray-500 text-xl font-semibold">
								No Data
							</span>
						</div>
					)}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={
									keyCounts.landing_impulse_asym_percent_L === 0
										? [-10, 50]
										: null
								}
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
				<section className="relative mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Landing Impulse Asymmetry Right (%)
					</h2>

					{keyCounts.landing_impulse_asym_percent_R === 0 && (
						<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
							<span className="text-gray-500 text-xl font-semibold">
								No Data
							</span>
						</div>
					)}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={
									keyCounts.landing_impulse_asym_percent_R === 0
										? [-10, 50]
										: null
								}
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
			</div>
		</>
	);
}

export default ForcePlate;
