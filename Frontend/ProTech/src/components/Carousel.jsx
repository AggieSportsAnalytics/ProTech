import React, { useState } from "react";
import Slider from "react-slick";
import AthleteCard from "./AthleteCard";
import DropdownFilter from "./DropdownFilter"; // Import your existing DropdownFilter component
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

function Carousel({ athletes }) {
	const [selectedPosition, setSelectedPosition] = useState(""); // Track the selected position

	console.log(athletes);

	// Create a list of unique positions for the dropdown
	const positions = [
		...new Set(athletes.map((athlete) => athlete.position)),
		"All Positions",
	];

	// Filter athletes based on the selected position
	const filteredAthletes =
		selectedPosition === "" || selectedPosition === "All Positions"
			? athletes
			: athletes.filter((athlete) => athlete.position === selectedPosition);

	// Carousel settings
	const settings = {
		dots: true,
		infinite: false,
		speed: 500,
		slidesToShow: 1,
		slidesToScroll: 1,
		centerMode: true,
		focusOnSelect: true,
		variableWidth: false,
		adaptiveHeight: true,
		arrows: filteredAthletes.length > 1,
	};

	return (
		<div className="carousel-container">
			<DropdownFilter
				positions={positions}
				selectedPosition={selectedPosition}
				onPositionChange={setSelectedPosition}
			/>

			<Slider {...settings}>
				{filteredAthletes.map((athlete, index) => (
					<div key={athlete.name}>
						<AthleteCard athlete={athlete} />
					</div>
				))}
			</Slider>
		</div>
	);
}

export default Carousel;
