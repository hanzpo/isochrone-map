import type { IsochroneResult } from '../types/map';

interface TravelTimeParams {
  lng: number;
  lat: number;
  travelTimeSeconds: number;
}

export async function fetchTransitIsochrone(params: TravelTimeParams): Promise<IsochroneResult> {
  const { lng, lat, travelTimeSeconds } = params;

  const departureTime = new Date();
  departureTime.setMinutes(departureTime.getMinutes() + 5);

  const body = {
    departure_searches: [
      {
        id: 'transit-isochrone',
        coords: { lat, lng },
        departure_time: departureTime.toISOString(),
        travel_time: travelTimeSeconds,
        transportation: { type: 'public_transport' },
      },
    ],
  };

  const res = await fetch('/api/traveltime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TravelTime API error: ${res.status} — ${text}`);
  }

  return res.json() as Promise<IsochroneResult>;
}
