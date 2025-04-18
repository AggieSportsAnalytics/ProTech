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
	ReferenceLine,
} from "recharts";
import supabase from "../utils/supabase";
import Loader from "./Loader";

function ForcePlate({ name }) {
	const [forcePlateData, setForcePlateData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		async function getForcePlateData() {
			setLoading(true);
			const { data: baselineData, error: baselineError } = await supabase
				.from("ForcePlate_Baseline")
				.select("*")
				.eq("name", name);

			const { data: weeklyData, error: weeklyError } = await supabase
				.from("ForcePlate_Weekly")
				.select("*")
				.eq("name", name);

			if (baselineError || weeklyError) {
				console.error("Supabase error:", baselineError || weeklyError);
				setError((baselineError || weeklyError)?.message || "Unknown error");
			} else if (baselineData && weeklyData) {
				const combined = [...(baselineData || []), ...(weeklyData || [])];
				const sortedData = combined.sort(
					(a, b) => new Date(a.date) - new Date(b.date),
				);
				setForcePlateData(sortedData);
			} else {
				console.error("Error getting force plate data:", error);
				setForcePlateData([]);
			}
			setLoading(false);
		}

		getForcePlateData();
	}, [name]);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	if (forcePlateData.length === 0 && !loading) {
		return <div className="p-8">No data found for this athlete.</div>;
	}

	return (
		<div className="container mx-auto px-4 py-6">
			<h1 className="text-2xl font-bold mb-8">Force Plate Data for {name}</h1>

			{/* RSI Modified (full width) */}
			<section className="mb-8">
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

			{/* Jump Height (full width) */}
			<section className="mb-8">
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

			{/* Paired Asymmetry Charts */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{/* Concentric Impulse Asymmetry */}
				<section className="mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Concentric Impulse Asymmetry Left (%)
					</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={[-10, 50]}
								label={{
									value: "Asymmetry (%)",
									angle: -90,
									position: "insideLeft",
								}}
							/>
							<Tooltip />
							<Legend />
							<ReferenceLine
								y={15}
								stroke="red"
								strokeDasharray="3 3"
								label="High Risk (15%)"
							/>
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
				<section className="mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Concentric Impulse Asymmetry Right (%)
					</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={[-10, 50]}
								label={{
									value: "Asymmetry (%)",
									angle: -90,
									position: "insideLeft",
								}}
							/>
							<Tooltip />
							<Legend />
							<ReferenceLine
								y={15}
								stroke="red"
								strokeDasharray="3 3"
								label="High Risk (15%)"
							/>
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

				{/* Eccentric Deceleration Impulse Asymmetry */}
				<section className="mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Eccentric Deceleration Impulse Asymmetry Left (%)
					</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={[-10, 50]}
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
				<section className="mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Eccentric Deceleration Impulse Asymmetry Right (%)
					</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={[-10, 50]}
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

				{/* Landing Impulse Asymmetry */}
				<section className="mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Landing Impulse Asymmetry Left (%)
					</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={[-10, 50]}
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
				<section className="mb-8">
					<h2 className="text-xl font-semibold mb-4">
						Landing Impulse Asymmetry Right (%)
					</h2>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={forcePlateData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis
								domain={[-10, 50]}
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
		</div>
	);
}

export default ForcePlate;
