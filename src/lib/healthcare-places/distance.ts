/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null) return "Distance unknown";
  if (meters < 1000) {
    return `~${meters} m away`;
  }
  const km = (meters / 1000).toFixed(1);
  return `~${km} km away`;
}

/**
 * Clearly labels distance as straight-line distance, distinguishing it from road/driving distance.
 */
export function formatStraightLineDistance(meters?: number): string {
  if (meters === undefined || meters === null) return "Distance unknown";
  if (meters < 1000) {
    return `~${meters} m (straight-line)`;
  }
  const km = (meters / 1000).toFixed(1);
  return `~${km} km (straight-line)`;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
