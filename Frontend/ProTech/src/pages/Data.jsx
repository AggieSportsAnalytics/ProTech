import { useState, useEffect } from "react";
import supabase from "../utils/supabase";
import Loader from "../components/Loader";
import AddDataModal from "../components/AddDataModal";
import { FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

function Data() {
	const [names, setNames] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const navigate = useNavigate();

	const handleDelete = async (name) => {
		try {
			const confirmed = window.confirm(
				"Are you sure you want to delete this athlete and all their data? This action is irreversible.",
			);

			if (!confirmed) {
				return;
			}

			const { error: forceplateBaselineError } = await supabase
				.from("ForcePlate_Baseline")
				.delete()
				.eq("name", name);
			if (forceplateBaselineError) {
				return;
			}

			const { error: forceplateWeeklyError } = await supabase
				.from("ForcePlate_Weekly")
				.delete()
				.eq("name", name);
			if (forceplateWeeklyError) {
				return;
			}

			const { error: nordboardError } = await supabase
				.from("NordBoard")
				.delete()
				.eq("name", name);
			if (nordboardError) {
				return;
			}

			const { error: namesError } = await supabase
				.from("names")
				.delete()
				.eq("name", name);
			if (namesError) {
				return;
			}

			alert("Deleted successfully!");
		} catch (err) {
			console.error("Error deleting:", err.message);
			alert("Failed to delete.");
		}
	};

	useEffect(() => {
		const getAllNames = async () => {
			setLoading(true);
			const { data, error } = await supabase.from("names").select("*");

			if (error) {
				console.error("Supabase error:", error);
				setError(error.message);
			} else if (data) {
				const nameList = data.map((item) => item.name);
				setNames(nameList);
			} else {
				console.error("Error fetching names:", error);
				setNames([]);
			}

			setLoading(false);
		};

		getAllNames();
	}, []);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	if (names.length === 0 && !loading) {
		return <div className="p-8">No players found.</div>;
	}

	return (
		<div className="mx-auto p-6">
			<h1 className="text-2xl font-bold mb-6 text-gray-800">Athletes</h1>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
				{names.map((name) => (
					<div
						type="button"
						onClick={() => navigate(`/data/${name.replaceAll(" ", "-")}`)}
						key={name}
						className="flex justify-between items-center bg-white pl-2 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 hover:border-blue-300"
					>
						<p className="text-blue-600 hover:text-blue-800 font-medium truncate">
							{name}
						</p>

						<button
							type="button"
							className="text-red-500 hover:text-red-700 ml-4"
							onClick={(e) => {
								e.stopPropagation();
								e.preventDefault();
								handleDelete(name);
							}}
						>
							<FiTrash2 size={16} />
						</button>
					</div>
				))}
			</div>

			<button
				onClick={() => setIsModalOpen(true)}
				type="button"
				className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
			>
				<span className="text-3xl">+</span>
			</button>
			<AddDataModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
		</div>
	);
}

export default Data;
