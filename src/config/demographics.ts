import type { DemographicLayer, DemographicMetric, EthnicityGroup } from '../types/demographics';

// Shared ethnicity color palette — used by map, legend, and popup
export const ETHNICITY_GROUPS: EthnicityGroup[] = [
  { key: 'white', label: 'White', color: '#4e79a7' },
  { key: 'black', label: 'Black', color: '#f28e2b' },
  { key: 'hispanic', label: 'Hispanic/Latino', color: '#e15759' },
  { key: 'asian', label: 'Asian', color: '#76b7b2' },
  { key: 'south_asian', label: 'South Asian', color: '#59a14f' },
  { key: 'chinese', label: 'Chinese', color: '#9c755f' },
  { key: 'filipino', label: 'Filipino', color: '#bab0ac' },
  { key: 'arab', label: 'Arab', color: '#d4a6c8' },
  { key: 'indigenous', label: 'Indigenous', color: '#9d7660' },
  { key: 'other', label: 'Other', color: '#bab0ac' },
];

export const ETHNICITY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ETHNICITY_GROUPS.map((g) => [g.key, g.color]),
);

export const DEMOGRAPHIC_LAYERS: DemographicLayer[] = [
  {
    id: 'income',
    label: 'Income',
    enabled: true,
    property: 'income',
    colorMode: 'interpolate',
    colorStops: [
      [20000, '#f1eef6'],
      [40000, '#d4b9da'],
      [60000, '#c994c7'],
      [80000, '#df65b0'],
      [100000, '#dd1c77'],
      [150000, '#980043'],
    ],
    unit: '$',
    formatValue: (val: number) =>
      '$' + Math.round(val / 1000) + 'k',
  },
  {
    id: 'race',
    label: 'Ethnicity',
    enabled: true,
    property: 'dominant_group',
    colorMode: 'categorical',
    colorStops: [], // not used for categorical
    categoryColors: ETHNICITY_COLOR_MAP,
    unit: '',
    formatValue: () => '',
  },
  {
    id: 'population',
    label: 'Density',
    enabled: true,
    property: 'density',
    colorMode: 'interpolate',
    colorStops: [
      [100, '#feebe2'],
      [500, '#fcc5c0'],
      [1000, '#fa9fb5'],
      [5000, '#f768a1'],
      [10000, '#c51b8a'],
      [50000, '#7a0177'],
    ],
    unit: '/km²',
    formatValue: (val: number) =>
      val >= 1000
        ? (val / 1000).toFixed(1) + 'k/km²'
        : Math.round(val) + '/km²',
  },
  {
    id: 'education',
    label: 'Education',
    enabled: true,
    property: 'bachelors_pct',
    colorMode: 'interpolate',
    colorStops: [
      [5, '#edf8fb'],
      [15, '#b2e2e2'],
      [25, '#66c2a4'],
      [40, '#2ca25f'],
      [60, '#006d2c'],
      [80, '#00441b'],
    ],
    unit: '%',
    formatValue: (val: number) => val.toFixed(0) + '% BA+',
  },
  {
    id: 'crime',
    label: 'Crime',
    enabled: false,
    property: 'crime_rate',
    colorMode: 'interpolate',
    colorStops: [
      [0, '#ffffb2'],
      [200, '#fecc5c'],
      [400, '#fd8d3c'],
      [600, '#f03b20'],
      [1000, '#bd0026'],
    ],
    unit: '/100k',
    formatValue: (val: number) => Math.round(val) + '/100k',
  },
];

export function getDemographicLayer(metric: DemographicMetric): DemographicLayer {
  return DEMOGRAPHIC_LAYERS.find((l) => l.id === metric)!;
}

// US Census Bureau ACS 5-Year variable codes
export const CENSUS_US_VARS: Record<Exclude<DemographicMetric, 'crime'>, string[]> = {
  income: ['B19013_001E'],
  race: [
    'B03002_001E', // total
    'B03002_003E', // white
    'B03002_004E', // black
    'B03002_005E', // AIAN
    'B03002_006E', // asian
    'B03002_007E', // NHPI
    'B03002_008E', // other
    'B03002_009E', // two+
    'B03002_012E', // hispanic
  ],
  population: ['B01003_001E'],
  education: [
    'B15003_001E', // total 25+
    'B15003_022E', // bachelor's
    'B15003_023E', // master's
    'B15003_024E', // professional
    'B15003_025E', // doctorate
  ],
};

// CensusMapper vector IDs for Canada (2021 Census)
export const CENSUS_CA_VECTORS: Record<Exclude<DemographicMetric, 'crime'>, string[]> = {
  income: ['v_CA21_906'],
  race: [
    'v_CA21_4872', // universe total (all persons in private households)
    'v_CA21_4875', // total visible minority
    'v_CA21_4878', // South Asian
    'v_CA21_4881', // Chinese
    'v_CA21_4884', // Black
    'v_CA21_4887', // Filipino
    'v_CA21_4890', // Arab
    'v_CA21_4893', // Latin American
    'v_CA21_4896', // Southeast Asian
    'v_CA21_4899', // West Asian
    'v_CA21_4902', // Korean
    'v_CA21_4905', // Japanese
    'v_CA21_4908', // Visible minority n.i.e.
    'v_CA21_4911', // Multiple visible minorities
    'v_CA21_4914', // Not a visible minority
  ],
  population: ['v_CA21_1', 'v_CA21_6'],
  education: [
    'v_CA21_5817', // total 25-64
    'v_CA21_5820', // no cert/diploma
    'v_CA21_5823', // high school
    'v_CA21_5826', // postsecondary cert
    'v_CA21_5835', // bachelor's or higher
  ],
};

// Canadian CMA lookup table: [code, name, west, south, east, north]
export const CANADA_CMAS: [string, string, number, number, number, number][] = [
  ['35535', 'Toronto', -80.15, 43.40, -78.70, 44.30],
  ['24462', 'Montréal', -74.20, 45.30, -73.40, 45.75],
  ['59933', 'Vancouver', -123.30, 49.00, -122.40, 49.45],
  ['35505', 'Ottawa–Gatineau', -76.40, 45.15, -75.20, 45.65],
  ['48825', 'Calgary', -114.40, 50.80, -113.80, 51.30],
  ['48835', 'Edmonton', -114.00, 53.30, -113.10, 53.80],
  ['35532', 'Hamilton', -80.20, 43.10, -79.60, 43.40],
  ['46602', 'Winnipeg', -97.50, 49.65, -96.80, 50.05],
  ['47725', 'Saskatoon', -107.00, 52.00, -106.40, 52.30],
  ['12205', 'Halifax', -63.90, 44.40, -63.30, 44.85],
  ['35537', 'Kitchener', -80.80, 43.25, -80.15, 43.60],
  ['35555', 'London', -81.50, 42.80, -81.00, 43.15],
  ['10001', "St. John's", -53.00, 47.40, -52.40, 47.75],
  ['59935', 'Victoria', -123.80, 48.35, -123.20, 48.70],
  ['13310', 'Moncton', -65.10, 46.00, -64.60, 46.25],
  ['47750', 'Regina', -104.80, 50.35, -104.40, 50.60],
  ['35559', 'Windsor', -83.20, 42.15, -82.80, 42.45],
  ['24421', 'Québec', -71.60, 46.70, -71.00, 47.05],
  ['59932', 'Abbotsford', -122.50, 49.00, -122.00, 49.20],
  ['59915', 'Kelowna', -119.70, 49.75, -119.30, 50.05],
  ['35529', 'Guelph', -80.40, 43.45, -80.15, 43.65],
  ['48830', 'Lethbridge', -112.95, 49.60, -112.70, 49.80],
  ['35544', 'Oshawa', -79.10, 43.80, -78.60, 44.10],
  ['59934', 'Nanaimo', -124.10, 49.05, -123.80, 49.30],
];
