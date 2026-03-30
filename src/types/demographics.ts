export type DemographicMetric = 'income' | 'race' | 'population' | 'education' | 'crime';

export interface DemographicLayer {
  id: DemographicMetric;
  label: string;
  enabled: boolean;
  property: string;
  colorMode: 'interpolate' | 'categorical';
  colorStops: [number, string][];
  categoryColors?: Record<string, string>;
  unit: string;
  formatValue: (val: number) => string;
}

export interface EthnicityGroup {
  key: string;
  label: string;
  color: string;
}

export interface DemographicData {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
  metric: DemographicMetric;
  country: 'us' | 'ca';
}
