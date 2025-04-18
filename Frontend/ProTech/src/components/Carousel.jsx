import React, { useState } from 'react';
import Slider from 'react-slick';
import AthleteCard from './AthleteCard';
import DropdownFilter from './DropdownFilter'; // Import your existing DropdownFilter component
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

function Carousel({ athletes }) {
  const [selectedPosition, setSelectedPosition] = useState(""); // Track the selected position

  // Create a list of unique positions for the dropdown
  const positions = [...new Set(athletes.map((athlete) => athlete.position)), "All Positions"];

  // Filter athletes based on the selected position
  const filteredAthletes = selectedPosition === "" || selectedPosition === "All Positions"
    ? athletes
    : athletes.filter((athlete) => athlete.position === selectedPosition);

  // Remove duplicate athletes (if any)
  const uniqueAthletes = [
    ...new Map(filteredAthletes.map((athlete) => [athlete.id, athlete])).values(),
  ];

  // Carousel settings
  const settings = {
    dots: true,
    infinite: false, // Infinite scrolling
    speed: 500,
    slidesToShow: 1, // Display one card at a time
    slidesToScroll: 1,
    centerMode: true, // Keeps the active slide centered
    focusOnSelect: true, // Makes the selected card focus
    variableWidth: false, // Set to true to allow variable card widths
    adaptiveHeight: true,
    arrows: uniqueAthletes.length > 1, // Adjust height to the content of the slide
  };

  return (
    <div className="carousel-container">
      {/* Pass positions and selected position to your existing DropdownFilter component */}
      <DropdownFilter 
        positions={positions} 
        selectedPosition={selectedPosition} 
        onPositionChange={setSelectedPosition} 
      />

      <Slider {...settings}>
        {uniqueAthletes.map((athlete) => (
          <div key={athlete.id}>
            <AthleteCard athlete={athlete} />
          </div>
        ))}
      </Slider>
    </div>
  );
}

export default Carousel;
