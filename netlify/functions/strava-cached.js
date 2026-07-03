const { getStore } = require('@netlify/blobs');

// Serves whatever was last synced for that date, instantly, without calling
// Strava again. The actual Sync button still hits strava-activities.js,
// which refreshes from Strava AND updates this cache for everyone else.
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const date = event.queryStringParameters && event.queryStringParameters.date;
  if (!date) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing date' }) };

  const store = getStore({ name: 'strava-cache', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
  const cached = await store.get(date, { type: 'json' });
  return { statusCode: 200, headers, body: JSON.stringify(cached || null) };
};
