import { useState, useEffect } from "react";
import Carousel from "../components/Carousel";
import "../Index.css";
import Loader from "../components/Loader";
import supabase from "../utils/supabase";
import RecruitmentModal from "../components/RecruitmentModal";

function Recruitment() {
	const [selectedPosition] = useState("");
	const [athletes, setAthletes] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		const getAllPlayers = async () => {
			setLoading(true);
			const { data, error } = await supabase.from("Athlete_Data").select("*");

			if (error) {
				console.error("Supabase error:", error);
				setError(error.message);
			} else if (data) {
				setAthletes(data);
			} else {
				console.error("Error fetching names:", error);
				setAthletes([]);
			}

			setLoading(false);
		};

		getAllPlayers();
	}, []);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	if (athletes.length === 0 && !loading) {
		return <div className="p-8">No players found.</div>;
	}

	// Filter athletes by selected position
	const filteredAthletes = selectedPosition
		? athletes.filter((athlete) => athlete.position === selectedPosition)
		: athletes;

	return (
		<div className="App">
			<img
				src="/logo.png"
				alt="Company Logo"
				className="logo cursor-pointer"
				onClick={() => (window.location.href = "/")}
			/>
			<h1>UC Davis Football</h1>

			{/* Explanation Section */}
			<div className="explanation">
				<p>
					Please find your position listed in the dropdown menu. Scroll through
					the different current UC Davis players!
				</p>
			</div>
			<Carousel athletes={filteredAthletes} />
			<button
				onClick={() => setIsModalOpen(true)}
				type="button"
				className="z-50 fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			>
				<span className="text-3xl">+</span>
			</button>
			<RecruitmentModal
				isModalOpen={isModalOpen}
				setIsModalOpen={setIsModalOpen}
			/>
		</div>
	);
}

export default Recruitment;
