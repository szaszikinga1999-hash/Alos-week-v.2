const { getStore } = require('@netlify/blobs');

// The app calls this with ?date=YYYY-MM-DD. It refreshes the Strava access
// token behind the scenes (using the stored refresh_token) and returns that
// day's activities as clean JSON. No login step, no Claude connection —
// just your own Strava app talking to your own backend.
exports.handler = async (event) => {
  const dateStr = event.queryStringParameters && event.queryStringParameters.date;
  if (!dateStr) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing ?date=YYYY-MM-DD parameter' }),
    };
  }

  const store = getStore('strava-tokens');
  const tokens = await store.get('tokens', { type: 'json' });
  if (!tokens || !tokens.refresh_token) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Strava not connected yet. Visit /.netlify/functions/strava-auth-start once to connect.' }),
    };
  }

  // Always refresh — Strava access tokens expire after 6 hours, refresh is cheap and safe.
  const refreshRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshed.access_token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Could not refresh Strava token', details: refreshed }),
    };
  }

  // Strava sometimes rotates the refresh token — always save whatever it gives back.
  await store.setJSON('tokens', {
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
    access_token: refreshed.access_token,
    expires_at: refreshed.expires_at,
  });

  const dayStart = Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
  const dayEnd = Math.floor(new Date(dateStr + 'T23:59:59Z').getTime() / 1000);

  const actRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${dayStart}&before=${dayEnd}&per_page=30`,
    { headers: { Authorization: `Bearer ${refreshed.access_token}` } }
  );
  const activities = await actRes.json();

  const simplified = (Array.isArray(activities) ? activities : []).map(a => ({
    name: a.name,
    sport_type: a.sport_type,
    distance_m: a.distance,
    moving_time_s: a.moving_time,
    elevation_gain_m: a.total_elevation_gain,
    avg_speed_ms: a.average_speed,
    max_speed_ms: a.max_speed,
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ activities: simplified }),
  };
};
