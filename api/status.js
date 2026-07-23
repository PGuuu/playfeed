const { sendJson, supabaseRest } = require('./_lib');

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const phuzeConfigured = !!(
    process.env.PHUZE_SECRET_KEY ||
    process.env.phuze_secret_key
  );
  const supabaseConfigured = !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.supabase_service_role_key
  );

  let database = { reachable: false, userGames: null, legacyGames: null };
  if (supabaseConfigured) {
    const [native, legacy] = await Promise.all([
      supabaseRest('user_games', { query: 'select=id' }),
      supabaseRest('remixes', {
        query: `select=id&base_id=${encodeURIComponent('eq.__playfeed_script_submission__')}`,
      }),
    ]);
    database = {
      reachable: native.ok && legacy.ok,
      userGames: native.ok && Array.isArray(native.data) ? native.data.length : null,
      legacyGames: legacy.ok && Array.isArray(legacy.data) ? legacy.data.length : null,
      nativeStatus: native.status,
      legacyStatus: legacy.status,
    };
  }

  return sendJson(response, 200, {
    ok: true,
    environment: process.env.VERCEL_ENV || 'unknown',
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || null,
    configuration: {
      phuzeSecret: phuzeConfigured,
      supabaseServiceRole: supabaseConfigured,
    },
    database,
  });
};
