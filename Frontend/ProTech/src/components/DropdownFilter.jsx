import React from 'react';

function DropdownFilter({ positions, selectedPosition, onPositionChange }) {
  return (
    <select value={selectedPosition} onChange={(e) => onPositionChange(e.target.value)}>
      <option value="">All Positions</option>
      {positions.map((position) => (
        <option key={position} value={position}>
          {position}
        </option>
      ))}
    </select>
  );
}

export default DropdownFilter;