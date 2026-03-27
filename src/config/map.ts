import type { IsochroneProfile, MapViewState } from '../types/map';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export const DEFAULT_VIEW: MapViewState = {
  lng: -73.9857,
  lat: 40.7484,
  zoom: 12,
};

export const PROFILES: IsochroneProfile[] = [
  { id: 'driving', label: 'Drive', provider: 'mapbox' },
  { id: 'cycling', label: 'Bike', provider: 'mapbox' },
  { id: 'walking', label: 'Walk', provider: 'mapbox' },
  { id: 'transit', label: 'Transit', provider: 'traveltime' },
];

export const DEFAULT_CONTOUR_MINUTES = [10, 20, 30];
export const DEFAULT_TRANSIT_MINUTES = 30;

export const CONTOUR_COLORS = ['#0073E6', '#00B67A', '#F59E0B'];
