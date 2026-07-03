const { getStore } = require('@netlify/blobs');

function store() {
  return getStore({ name: 'trip-checkins', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
}

// GET  ?day=d1        -> that day's check-ins (array)
// GET  (no params)    -> every day's check-ins at once, as { d1: [...], d2: [...] }
// POST { dayId, checkin }   -> adds a check-in to that day
// POST { dayId, deleteId }  -> removes a check-in from that day
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const s = store();

  if (event.httpMethod === 'GET') {
    const day = event.queryStringParameters && event.queryStringParameters.day;
    if (day) {
      const data = await s.get(day, { type: 'json' });
      return { statusCode: 200, headers, body: JSON.stringify(data || []) };
    }
    const { blobs } = await s.list();
    const result = {};
    for (const b of blobs) {
      result[b.key] = (await s.get(b.key, { type: 'json' })) || [];
    }
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { dayId, checkin, deleteId } = body;
    if (!dayId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing dayId' }) };

    let arr = (await s.get(dayId, { type: 'json' })) || [];
    if (deleteId) {
      arr = arr.filter(c => c.id !== deleteId);
    } else if (checkin) {
      arr = arr.filter(c => c.id !== checkin.id); // avoid duplicates if re-posted
      arr.unshift(checkin);
    }
    await s.setJSON(dayId, arr);
    return { statusCode: 200, headers, body: JSON.stringify(arr) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
