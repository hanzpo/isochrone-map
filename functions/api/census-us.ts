interface Env {
  CENSUS_API_KEY: string;
}

const TIGERWEB_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/8/query';

const CENSUS_API_URL = 'https://api.census.gov/data/2022/acs/acs5';

const METRIC_VARS: Record<string, string[]> = {
  income: ['B19013_001E'],
  race: [
    'B03002_001E',
    'B03002_003E',
    'B03002_004E',
    'B03002_005E',
    'B03002_006E',
    'B03002_007E',
    'B03002_008E',
    'B03002_009E',
    'B03002_012E',
  ],
  population: ['B01003_001E'],
  education: ['B15003_001E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E'],
};

interface TigerFeature {
  type: 'Feature';
  properties: { GEOID: string; STATE: string; COUNTY: string; TRACT: string; AREALAND: number };
  geometry: GeoJSON.Geometry;
}

interface TigerResponse {
  type: 'FeatureCollection';
  features: TigerFeature[];
  exceededTransferLimit?: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { CENSUS_API_KEY } = context.env;
  if (!CENSUS_API_KEY) {
    return jsonResponse({ error: 'Census API key not configured' }, 500);
  }

  const url = new URL(context.request.url);
  const bbox = url.searchParams.get('bbox');
  const metric = url.searchParams.get('metric');

  if (!bbox || !metric || !(metric in METRIC_VARS)) {
    return jsonResponse({ error: 'Missing or invalid bbox/metric parameter' }, 400);
  }

  const [west, south, east, north] = bbox.split(',').map(Number);

  try {
    // Step 1: Fetch tract geometries from TIGERweb
    const geomJson = JSON.stringify({
      xmin: west, ymin: south, xmax: east, ymax: north,
      spatialReference: { wkid: 4326 },
    });
    const tigerParams = new URLSearchParams({
      geometry: geomJson,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'GEOID,STATE,COUNTY,TRACT,AREALAND',
      f: 'geojson',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: '2000',
    });

    const tigerRes = await fetch(`${TIGERWEB_URL}?${tigerParams}`);
    if (!tigerRes.ok) {
      return jsonResponse({ error: `TIGERweb error: ${tigerRes.status}` }, 502);
    }

    const tigerData = (await tigerRes.json()) as TigerResponse;
    if (!tigerData.features?.length) {
      return jsonResponse({ type: 'FeatureCollection', features: [], metric, country: 'us' });
    }

    // If exceeded limit, try subdividing bbox into quadrants
    let allFeatures = tigerData.features;
    if (tigerData.exceededTransferLimit) {
      allFeatures = await fetchSubdivided(west, south, east, north);
    }

    // Step 2: Group tracts by state+county
    const countyGroups = new Map<string, string[]>();
    for (const f of allFeatures) {
      const key = `${f.properties.STATE}|${f.properties.COUNTY}`;
      if (!countyGroups.has(key)) countyGroups.set(key, []);
      countyGroups.get(key)!.push(f.properties.GEOID);
    }

    // Step 3: Fetch ACS data for each state+county (parallel)
    const vars = METRIC_VARS[metric];
    const dataLookup = new Map<string, number[]>();

    const fetches = Array.from(countyGroups.entries()).map(async ([key]) => {
      const [state, county] = key.split('|');
      const censusParams = new URLSearchParams({
        get: ['NAME', ...vars].join(','),
        for: 'tract:*',
        in: `state:${state} county:${county}`,
        key: CENSUS_API_KEY,
      });

      const res = await fetch(`${CENSUS_API_URL}?${censusParams}`);
      if (!res.ok) return;

      const rows = (await res.json()) as string[][];
      if (rows.length < 2) return;

      const headers = rows[0];
      const stateIdx = headers.indexOf('state');
      const countyIdx = headers.indexOf('county');
      const tractIdx = headers.indexOf('tract');
      const varIndices = vars.map((v) => headers.indexOf(v));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
        const values = varIndices.map((idx) => {
          const val = parseFloat(row[idx]);
          return isNaN(val) ? -1 : val;
        });
        dataLookup.set(geoid, values);
      }
    });

    await Promise.all(fetches);

    // Step 4: Join data to geometries
    const enrichedFeatures = allFeatures
      .map((f) => {
        const values = dataLookup.get(f.properties.GEOID);
        if (!values) return null;

        const props = computeMetricProperties(metric, values, f.properties.AREALAND);
        if (props === null) return null;

        return {
          type: 'Feature' as const,
          geometry: f.geometry,
          properties: {
            geoid: f.properties.GEOID,
            ...props,
          },
        };
      })
      .filter(Boolean);

    return jsonResponse({
      type: 'FeatureCollection',
      features: enrichedFeatures,
      metric,
      country: 'us',
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
};

async function fetchSubdivided(
  west: number,
  south: number,
  east: number,
  north: number,
): Promise<TigerFeature[]> {
  const midLng = (west + east) / 2;
  const midLat = (south + north) / 2;
  const quads = [
    [west, south, midLng, midLat],
    [midLng, south, east, midLat],
    [west, midLat, midLng, north],
    [midLng, midLat, east, north],
  ];

  const results = await Promise.all(
    quads.map(async ([w, s, e, n]) => {
      const geom = JSON.stringify({
        xmin: w, ymin: s, xmax: e, ymax: n,
        spatialReference: { wkid: 4326 },
      });
      const params = new URLSearchParams({
        geometry: geom,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'GEOID,STATE,COUNTY,TRACT,AREALAND',
        f: 'geojson',
        returnGeometry: 'true',
        outSR: '4326',
        resultRecordCount: '2000',
      });

      const res = await fetch(`${TIGERWEB_URL}?${params}`);
      if (!res.ok) return [];
      const data = (await res.json()) as TigerResponse;
      return data.features || [];
    }),
  );

  // Dedupe by GEOID
  const seen = new Set<string>();
  const features: TigerFeature[] = [];
  for (const batch of results) {
    for (const f of batch) {
      if (!seen.has(f.properties.GEOID)) {
        seen.add(f.properties.GEOID);
        features.push(f);
      }
    }
  }
  return features;
}

function computeMetricProperties(
  metric: string,
  values: number[],
  arealand: number,
): Record<string, number> | null {
  switch (metric) {
    case 'income': {
      const income = values[0];
      if (income < 0) return null;
      return { income };
    }
    case 'race': {
      // values: [total, white, black, AIAN, asian, NHPI, other, two+, hispanic]
      const total = values[0];
      if (total <= 0) return null;
      const groups = [
        { key: 'white', val: values[1] },
        { key: 'black', val: values[2] },
        { key: 'indigenous', val: values[3] },
        { key: 'asian', val: values[4] },
        { key: 'other', val: values[5] + values[6] + values[7] }, // NHPI + other + two+
        { key: 'hispanic', val: values[8] },
      ];
      let dominant = groups[0];
      const result: Record<string, number | string> = {};
      for (const g of groups) {
        const pct = Math.round((Math.max(0, g.val) / total) * 1000) / 10;
        result[`pct_${g.key}`] = pct;
        if (g.val > dominant.val) dominant = g;
      }
      result.dominant_group = dominant.key;
      result.dominant_pct = Math.round((Math.max(0, dominant.val) / total) * 1000) / 10;
      return result as Record<string, number>;
    }
    case 'population': {
      const pop = values[0];
      if (pop < 0 || arealand <= 0) return null;
      const densityPerKm2 = pop / (arealand / 1_000_000);
      return {
        population: pop,
        density: Math.round(densityPerKm2 * 10) / 10,
      };
    }
    case 'education': {
      const total25 = values[0];
      if (total25 <= 0) return null;
      const bachelorsPlus = values.slice(1).reduce((s, v) => s + Math.max(0, v), 0);
      return { bachelors_pct: Math.round((bachelorsPlus / total25) * 1000) / 10 };
    }
    default:
      return null;
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
