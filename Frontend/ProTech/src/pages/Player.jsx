import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import NordBoard from "../components/NordBoard";
import ForcePlate from "../components/ForcePlate";
import AthleteComparisonChart from "../components/AthleteComparisonChart";
import supabase from "../utils/supabase";
import Loader from "../components/Loader";

function Data() {
	const { id } = useParams();
	const [athlete, setAthlete] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const getAthleteData = async () => {
			try {
				const { data, error } = await supabase
					.from("names")
					.select("*")
					.eq("id", id)
					.single();

				if (error) throw error;
				setAthlete(data);
			} catch (error) {
				console.error("Error fetching athlete:", error);
			} finally {
				setLoading(false);
			}
		};

		getAthleteData();
	}, [id]);

	if (loading) return <Loader />;
	if (!athlete) return <div className="p-8">Athlete not found</div>;

	return (
		<div className="max-w-7xl mx-auto px-8 py-6">
			{/* Header */}
			<div className="mb-8">
				<button
					onClick={() => navigate('/data')}
					className="!m-0 mb-10 inline-flex items-center pr-4 pl-0 py-4 rounded-md text-sm font-medium text-white bg-[#0B1340] hover:bg-[#0b1340cc]"
				>
					← Back
				</button>
				<h1 className="text-3xl font-bold text-[#0B1340]">{athlete.name}</h1>
				<p className="text-gray-500 mt-1">{athlete.position}</p>
			</div>

			{/* Spider Graph */}
			<div className="mb-8">
				<h2 className="text-xl font-semibold text-[#0B1340] mb-4">Performance Overview</h2>
				<div className="bg-white rounded-lg shadow-sm p-6">
					<AthleteComparisonChart id={id} />
				</div>
			</div>

			{/* Data Tables */}
			<div className="space-y-8">
				<div className="bg-white rounded-lg shadow-sm p-6">
					<h2 className="text-xl font-semibold text-[#0B1340] mb-4">NordBoard Data</h2>
					<NordBoard id={id} />
				</div>

				<div className="bg-white rounded-lg shadow-sm p-6">
					<h2 className="text-xl font-semibold text-[#0B1340] mb-4">Force Plate Data</h2>
					<ForcePlate id={id} />
				</div>
			</div>
		</div>
	);
}

export default Data;
