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

function NordBoard({ name }) {
	const [nordData, setNordData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		async function getNordData() {
			setLoading(true);
			const { data, error } = await supabase
				.from("NordBoard")
				.select("*")
				.eq("name", name);

			if (error) {
				console.error("Supabase error:", error);
				setError(error.message);
			} else if (data) {
				const sortedData = data.sort(
					(a, b) => new Date(a.date) - new Date(b.date),
				);
				setNordData(sortedData);
			} else {
				console.error("Error getting nordboard data:", error);
				setNordData([]);
			}
			setLoading(false);
		}

		getNordData();
	}, [name]);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	if (nordData.length === 0 && !loading) {
		return <div className="p-8">No data found for this athlete.</div>;
	}

	return (
		<div>
			<h1 className="text-2xl font-bold mb-6">NordBoard Data for {name}</h1>
			<div className="mb-12">
				<ResponsiveContainer width="100%" height={400}>
					<LineChart data={nordData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="date" />
						<YAxis
							domain={[-50, 50]}
							label={{
								value: "Imbalance (%)",
								angle: -90,
								position: "insideLeft",
							}}
						/>
						<Tooltip />
						<Legend />
						<Line
							type="monotone"
							dataKey="max_imbalance_percent"
							stroke="#8884d8"
							name="Max Imbalance %"
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

export default NordBoard;
