import React, { useState } from "react";
import athletes from "../data/athletes";
//import DropdownFilter from './components/DropdownFilter';
import Carousel from "../components/Carousel";
import "../Index.css";
import logo from "../images/logo.png";

function Recruitment() {
	const [selectedPosition] = useState("");

	// Get unique positions
	//const positions = [...new Set(athletes.map((athlete) => athlete.position))];

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
