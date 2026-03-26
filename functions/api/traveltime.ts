interface Env {
  TRAVELTIME_APP_ID: string;
  TRAVELTIME_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { TRAVELTIME_APP_ID, TRAVELTIME_API_KEY } = context.env;

  if (!TRAVELTIME_APP_ID || !TRAVELTIME_API_KEY) {
    return new Response(JSON.stringify({ error: 'TravelTime credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await context.request.text();

  const res = await fetch('https://api.traveltimeapp.com/v4/time-map', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/geo+json',
      'X-Application-Id': TRAVELTIME_APP_ID,
      'X-Api-Key': TRAVELTIME_API_KEY,
    },
    body,
  });

  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
