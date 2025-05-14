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

function NordBoard({ id }) {
	const [nordData, setNordData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		async function getNordData() {
			setLoading(true);
			const { data, error } = await supabase
				.from("NordBoard")
				.select("*")
				.eq("id", id);

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
	}, [id]);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	return (
		<>
			<h1 className="text-2xl font-bold mb-6">
				{nordData?.length > 0 && <p>NordBoard Data for {nordData[0].name}</p>}
			</h1>
			<div className="relative mb-8">
				{nordData.length === 0 && (
					<div className="absolute inset-0 flex items-center justify-center bg-opacity-80 z-10">
						<span className="text-gray-500 text-xl font-semibold">No Data</span>
					</div>
				)}
				<ResponsiveContainer width="100%" height={300}>
					<LineChart data={nordData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="date" />
						<YAxis
							domain={nordData.length === 0 ? [-50, 50] : null}
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
		</>
	);
}

export default NordBoard;
