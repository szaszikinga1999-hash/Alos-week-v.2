// Visiting this URL once kicks off the Strava login/authorize screen.
// After you approve, Strava redirects to strava-auth.js which stores your tokens.
exports.handler = async (event) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return { statusCode: 500, body: 'STRAVA_CLIENT_ID is not set in Netlify environment variables yet.' };
  }
  const redirectUri = `https://${event.headers.host}/.netlify/functions/strava-auth`;
  const authUrl =
    `https://www.strava.com/oauth/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&approval_prompt=auto&scope=activity:read_all`;

  return {
    statusCode: 302,
    headers: { Location: authUrl },
  };
};
