const { getStore } = require('@netlify/blobs');

// Strava redirects here after you approve access. We trade the one-time
// "code" for a refresh_token, and store that token in Netlify Blobs so
// future requests never need you to log in again.
exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  if (!code) {
    return { statusCode: 400, body: 'Missing authorization code from Strava.' };
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { statusCode: 500, body: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set in Netlify environment variables yet.' };
  }

  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.refresh_token) {
    return { statusCode: 500, body: 'Strava did not return a refresh token: ' + JSON.stringify(tokenData) };
  }

  const store = getStore({ name: 'strava-tokens', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
  await store.setJSON('tokens', {
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token,
    expires_at: tokenData.expires_at,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `
      <html><body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
        <h2>Strava connected ✅</h2>
        <p>You can close this tab and go back to your app — syncing will work automatically from now on.</p>
      </body></html>
    `,
  };
};
