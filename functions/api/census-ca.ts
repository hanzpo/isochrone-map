interface Env {
  CENSUSMAPPER_API_KEY: string;
}

const CMAS: [string, string, number, number, number, number][] = [
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

const METRIC_VECTORS: Record<string, string[]> = {
  income: ['v_CA21_906'],
  race: [
    'v_CA21_4872', // [0] universe total (all persons in private households)
    'v_CA21_4875', // [1] total visible minority
    'v_CA21_4878', // [2] South Asian
    'v_CA21_4881', // [3] Chinese
    'v_CA21_4884', // [4] Black
    'v_CA21_4887', // [5] Filipino
    'v_CA21_4890', // [6] Arab
    'v_CA21_4893', // [7] Latin American
    'v_CA21_4896', // [8] Southeast Asian
    'v_CA21_4899', // [9] West Asian
    'v_CA21_4902', // [10] Korean
    'v_CA21_4905', // [11] Japanese
    'v_CA21_4908', // [12] Visible minority n.i.e.
    'v_CA21_4911', // [13] Multiple visible minorities
    'v_CA21_4914', // [14] Not a visible minority
  ],
  population: ['v_CA21_1', 'v_CA21_6'],
  education: ['v_CA21_5817', 'v_CA21_5820', 'v_CA21_5823', 'v_CA21_5826', 'v_CA21_5835'],
};

function findCMA(lng: number, lat: number): string | null {
  const pad = 0.2;
  for (const [code, , w, s, e, n] of CMAS) {
    if (lng >= w - pad && lng <= e + pad && lat >= s - pad && lat <= n + pad) {
      return code;
    }
  }
  return null;
}

function buildFormData(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { CENSUSMAPPER_API_KEY } = context.env;
  if (!CENSUSMAPPER_API_KEY) {
    return jsonResponse({ error: 'CensusMapper API key not configured' }, 500);
  }

  const url = new URL(context.request.url);
  const lng = parseFloat(url.searchParams.get('lng') || '');
  const lat = parseFloat(url.searchParams.get('lat') || '');
  const metric = url.searchParams.get('metric');

  if (isNaN(lng) || isNaN(lat) || !metric || !(metric in METRIC_VECTORS)) {
    return jsonResponse({ error: 'Missing or invalid lng/lat/metric parameter' }, 400);
  }

  const cmaCode = findCMA(lng, lat);
  if (!cmaCode) {
    return jsonResponse({
      type: 'FeatureCollection',
      features: [],
      metric,
      country: 'ca',
    });
  }

  const vectors = METRIC_VECTORS[metric];
  const regions = JSON.stringify({ CMA: [cmaCode] });

  try {
    // Fetch geometry and data in parallel (different endpoints)
    const [geoRes, dataRes] = await Promise.all([
      fetch('https://censusmapper.ca/api/v1/geo.geojson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buildFormData({
          dataset: 'CA21',
          level: 'CT',
          regions,
          api_key: CENSUSMAPPER_API_KEY,
        }),
      }),
      fetch('https://censusmapper.ca/api/v1/data.csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buildFormData({
          dataset: 'CA21',
          level: 'CT',
          regions,
          vectors: JSON.stringify(vectors),
          api_key: CENSUSMAPPER_API_KEY,
        }),
      }),
    ]);

    if (!geoRes.ok) {
      return jsonResponse({ error: `CensusMapper geo error: ${geoRes.status}` }, 502);
    }
    if (!dataRes.ok) {
      return jsonResponse({ error: `CensusMapper data error: ${dataRes.status}` }, 502);
    }

    const geojson = (await geoRes.json()) as GeoJSON.FeatureCollection;
    const csvText = await dataRes.text();

    // Parse CSV into lookup by GeoUID
    const dataLookup = parseCSV(csvText, vectors);

    // Join data to geometry
    const features = geojson.features
      .map((f) => {
        const geoUID = String(f.properties?.id || '');
        const vals = dataLookup.get(geoUID);
        if (!vals) return null;

        const area = parseFloat(String(f.properties?.a || '0'));
        const pop = parseInt(String(f.properties?.pop || '0'));
        const props = computeProperties(metric, vals, area, pop);
        if (!props) return null;

        return {
          type: 'Feature' as const,
          geometry: f.geometry,
          properties: props,
        };
      })
      .filter(Boolean);

    return jsonResponse({
      type: 'FeatureCollection',
      features,
      metric,
      country: 'ca',
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
};

// Parse a CSV line respecting quoted fields (handles commas inside quotes)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(csv: string, vectors: string[]): Map<string, number[]> {
  const lines = csv.split('\n');
  if (lines.length < 2) return new Map();

  const header = parseCSVLine(lines[0]);
  const vectorIndices = vectors.map((v) => {
    return header.findIndex((h) => h.startsWith(v));
  });

  const lookup = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;
    const geoUID = cols[0];
    const values = vectorIndices.map((idx) => {
      if (idx < 0 || idx >= cols.length) return -1;
      const val = parseFloat(cols[idx]);
      return isNaN(val) ? -1 : val;
    });
    lookup.set(geoUID, values);
  }
  return lookup;
}

function computeProperties(
  metric: string,
  vals: number[],
  area: number,
  pop: number,
): Record<string, number | string> | null {
  switch (metric) {
    case 'income': {
      const income = vals[0];
      if (income < 0) return null;
      return { income };
    }
    case 'race': {
      // vals indices: [0]=universe, [1]=total VM, [2]=South Asian, [3]=Chinese,
      // [4]=Black, [5]=Filipino, [6]=Arab, [7]=Latin American, [8]=SE Asian,
      // [9]=West Asian, [10]=Korean, [11]=Japanese, [12]=VM n.i.e., [13]=Multiple VM,
      // [14]=Not a visible minority
      const total = vals[0]; // universe total
      if (total <= 0) return null;
      const notVisMin = vals[14];
      const groups = [
        { key: 'white', val: notVisMin },
        { key: 'south_asian', val: vals[2] },
        { key: 'chinese', val: vals[3] },
        { key: 'black', val: vals[4] },
        { key: 'filipino', val: vals[5] },
        { key: 'arab', val: vals[6] },
        { key: 'hispanic', val: vals[7] }, // Latin American
        { key: 'asian', val: vals[8] + vals[9] + vals[10] + vals[11] }, // SE Asian + West Asian + Korean + Japanese
        { key: 'other', val: vals[12] + vals[13] }, // VM n.i.e. + Multiple VM
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
      return result;
    }
    case 'population': {
      if (pop < 0) return null;
      const density = area > 0 ? pop / area : 0;
      return { population: pop, density: Math.round(density * 10) / 10 };
    }
    case 'education': {
      const total = vals[0];
      if (total <= 0) return null;
      const bachelorsPlus = vals[4];
      return {
        bachelors_pct: bachelorsPlus >= 0 ? Math.round((bachelorsPlus / total) * 1000) / 10 : 0,
      };
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
