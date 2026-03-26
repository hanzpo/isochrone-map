export interface IsochroneProfile {
  id: 'driving' | 'walking' | 'cycling' | 'transit';
  label: string;
  provider: 'mapbox' | 'traveltime';
}

export interface IsochroneParams {
  lng: number;
  lat: number;
  profile: IsochroneProfile['id'];
  contourMinutes: number[];
}

export interface IsochroneResult {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
}

export interface MapViewState {
  lng: number;
  lat: number;
  zoom: number;
}
