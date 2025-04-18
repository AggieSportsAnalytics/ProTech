import React, { useState, useEffect } from "react";
//import DropdownFilter from './components/DropdownFilter';
import Carousel from "../components/Carousel";
import "../Index.css";
import logo from "/aggie.png";
import Loader from "../components/Loader";
import supabase from "../utils/supabase";

function Recruitment() {
	const [selectedPosition] = useState("");
	const [athletes, setAthletes] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

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
			<img src={logo} alt="Company Logo" className="logo" />
			<h1>UC Davis Football</h1>

			{/* Explanation Section */}
			<div className="explanation">
				<p>
					Please find your position listed in the dropdown menu. Scroll through
					the different current UC Davis players!
				</p>
			</div>
			<Carousel athletes={filteredAthletes} />
		</div>
	);
}

export default Recruitment;
