export function getETA(distance, speedKmH) {
  // Invalid distance
  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  // Bus is already at pickup point
  if (distance <= 50) {
    return 0;
  }

  // Convert meters to km
  const distanceKm = distance / 1000;

  // Use GPS speed if reliable
  // Otherwise use a reasonable city-bus fallback speed
  const effectiveSpeed =
    Number.isFinite(speedKmH) && speedKmH >= 10
      ? speedKmH
      : 25;

  const hours = distanceKm / effectiveSpeed;
  const minutes = Math.ceil(hours * 60);

  return Math.max(1, minutes);
}