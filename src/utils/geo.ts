export function detectCountry(lng: number, lat: number): 'us' | 'ca' {
  // Rough boundary: above 49th parallel is Canada (most of border)
  // Exception: southern Ontario/Quebec dip below 49
  if (lat > 49) return 'ca';
  if (lat > 42 && lng > -83 && lng < -74) return 'ca'; // southern Ontario/Quebec
  return 'us';
}
