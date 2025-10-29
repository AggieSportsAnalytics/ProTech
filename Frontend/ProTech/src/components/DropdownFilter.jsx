import React from 'react';

const positions = [
  "All Positions",
  "Quarterback",
  "Running Back",
  "Wide Receiver",
  "Tight End",
  "Offensive Line",
  "Defensive Line",
  "Linebacker",
  "Defensive Back",
  "Safety",
  "Kicker",
  "Punter"
];

function DropdownFilter({ selectedPosition, onPositionChange }) {
  return (
    <select
      value={selectedPosition}
      onChange={(e) => onPositionChange(e.target.value)}
      className="block w-full pl-3 pr-10 py-2 border-2 border-gray-200 rounded-lg focus:ring-[#0B1340] focus:border-[#0B1340]"
    >
      {positions.map((position) => (
        <option key={position} value={position}>
          {position}
        </option>
      ))}
    </select>
  );
}

export default DropdownFilter;