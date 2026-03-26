import { MAPBOX_TOKEN } from '../config/map';
import type { IsochroneParams, IsochroneResult } from '../types/map';

const BASE_URL = 'https://api.mapbox.com/isochrone/v1/mapbox';

export async function fetchIsochrone(params: IsochroneParams): Promise<IsochroneResult> {
  const { lng, lat, profile, contourMinutes } = params;
  const contours = contourMinutes.join(',');

  const url = `${BASE_URL}/${profile}/${lng},${lat}?contours_minutes=${contours}&polygons=true&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Isochrone API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<IsochroneResult>;
}
