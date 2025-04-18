import React from 'react';

function AthleteCard({ athlete }) {
  // Define the years dynamically based on the number of images
  //const baseYears = [2021, 2022, 2023, 2024];
  const availableYears = athlete.stats.map((stat) => stat.year); // Extract years from stats
  const imageYears = availableYears.slice(-athlete.images.length); // Match images to years dynamically

  return (
    <div className="athlete-card">
      <h3>{athlete.name}</h3>
      <p>Position: {athlete.position}</p>
      <p>Height: {athlete.height}</p>
      <p>Wing: {athlete.wing}</p>
      <p>Hand: {athlete.hand}</p>

      {/* Image carousel or grid */}
      <div className="athlete-images">
        {athlete.images.map((image, index) => (
          <div key={index} className="image-container">
            <img
              src={image}
              alt={`${athlete.name} ${imageYears[index]}`}
              className="athlete-image"
            />
            <p className="image-year">{imageYears[index]}</p>
          </div>
        ))}
      </div>

      {/* Stats table */}
      <table className="stats-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Body Weight</th>
            <th>Vertical Jump</th>
            <th>Broad Jump</th>
            <th>10-Yard Dash</th>
            <th>Flying 10</th>
            <th>40-Yard Dash</th>
            <th>Pro Agility</th>
            <th>L-Drill</th>
            <th>Hang Clean</th>
            <th>Back Squat</th>
            <th>Incline Bench</th>
          </tr>
        </thead>
        <tbody>
          {athlete.stats.map((stat) => (
            <tr key={stat.year}>
              <td>{stat.year}</td>
              <td>{stat.bodyWeight}</td>
              <td>{stat.verticalJump}</td>
              <td>{stat.broadJump}</td>
              <td>{stat.tenYard}</td>
              <td>{stat.flyingTen}</td>
              <td>{stat.fortyYard}</td>
              <td>{stat.proAgility}</td>
              <td>{stat.lDrill}</td>
              <td>{stat.hangClean}</td>
              <td>{stat.backSquat}</td>
              <td>{stat.inclineBench}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AthleteCard;
