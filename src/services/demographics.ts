import type { DemographicMetric, DemographicData } from '../types/demographics';

export async function fetchDemographicData(params: {
  bbox: [number, number, number, number]; // [west, south, east, north]
  lng: number;
  lat: number;
  metric: DemographicMetric;
  country: 'us' | 'ca';
}): Promise<DemographicData> {
  const { bbox, lng, lat, metric, country } = params;

  const endpoint = country === 'us' ? '/api/census-us' : '/api/census-ca';
  const searchParams = new URLSearchParams({ metric });

  if (country === 'us') {
    searchParams.set('bbox', bbox.join(','));
  } else {
    searchParams.set('lng', String(lng));
    searchParams.set('lat', String(lat));
  }

  const res = await fetch(`${endpoint}?${searchParams}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Demographics API error: ${res.status}`);
  }

  return res.json() as Promise<DemographicData>;
}
