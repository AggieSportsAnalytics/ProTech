// Utility functions for name formatting and sorting

/**
 * Converts "Last, First" format to "First Last" format
 * @param {string} name - Name in "Last, First" or "First Last" format
 * @returns {string} - Name in "First Last" format
 */
export function formatNameFirstLast(name) {
  if (!name) return "";
  
  const trimmed = name.trim();
  
  // Check if it's in "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  
  // Already in "First Last" format or single name
  return trimmed;
}

/**
 * Gets the last name from a name string (handles both "Last, First" and "First Last" formats)
 * @param {string} name - Name in any format
 * @returns {string} - Last name
 */
export function getLastName(name) {
  if (!name) return "";
  
  const trimmed = name.trim();
  
  // If it's in "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length >= 1) {
      return parts[0]; // Last name is before the comma
    }
  }
  
  // If it's in "First Last" format
  const parts = trimmed.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/**
 * Sorts an array of objects by last name (handles both "Last, First" and "First Last" formats)
 * @param {Array} arr - Array of objects with a 'name' property
 * @returns {Array} - Sorted array
 */
export function sortByLastName(arr) {
  return [...arr].sort((a, b) => {
    const lastNameA = getLastName(a.name || "").toLowerCase();
    const lastNameB = getLastName(b.name || "").toLowerCase();
    return lastNameA.localeCompare(lastNameB);
  });
}

