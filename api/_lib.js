const SUPABASE_URL_FALLBACK = 'https://oimdeoszgxfumwtmapok.supabase.co';

function sendJson(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.send(JSON.stringify(body));
}

function bearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function requestOriginAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestHost = String(request.headers.host || '').toLowerCase();
    if (originUrl.host.toLowerCase() === requestHost) return true;
    const configured = String(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    return configured.includes(origin);
  } catch {
    return false;
  }
}

async function readJson(request, maxBytes = 700_000) {
  const declared = Number(request.headers['content-length'] || 0);
  if (declared > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });

  if (request.body && typeof request.body === 'object') return request.body;
  const raw = typeof request.body === 'string' ? request.body : '';
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), { status: 400 });
  }
}

async function verifyPhuzeSession(request) {
  const secret = process.env.PHUZE_SECRET_KEY || process.env.phuze_secret_key;
  if (!secret) {
    return { error: { status: 503, message: 'PHUZE_SECRET_KEY is not configured.' } };
  }
  const token = bearerToken(request);
  if (!token) return { error: { status: 401, message: 'Please sign in again.' } };

  let verifyResponse;
  try {
    verifyResponse = await fetch('https://phuze.edato.me/api/v1/sessions/verify', {
      method: 'POST',
      headers: {
        Authorization: `Secret ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { error: { status: 502, message: 'Could not verify the login session.' } };
  }

  const result = await verifyResponse.json().catch(() => ({}));
  if (!verifyResponse.ok || !result.valid) {
    return { error: { status: 401, message: 'The login session is invalid or expired.' } };
  }

  const nested = result.user || result.session?.user || {};
  const id = result.uid || result.user_id || result.sub || nested.uid || nested.id || nested.user_id;
  const email = result.email || nested.email || '';
  if (!id) return { error: { status: 401, message: 'The verified session has no user ID.' } };
  return { user: { id: String(id), email: String(email || '') } };
}

async function supabaseRest(table, { method = 'GET', query = '', body, prefer = '' } = {}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key;
  if (!serviceKey) {
    return {
      ok: false,
      status: 503,
      data: null,
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.',
    };
  }
  const baseUrl = String(
    process.env.SUPABASE_URL ||
    process.env.supabase_url ||
    SUPABASE_URL_FALLBACK
  ).replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: serviceKey,
      ...(serviceKey.startsWith('sb_secret_')
        ? {}
        : { Authorization: `Bearer ${serviceKey}` }),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : (data?.message || data?.error || `Database request failed (${response.status}).`),
  };
}

function publicName(user) {
  const local = String(user.email || '').split('@')[0].trim();
  return (local || '玩家').slice(0, 40);
}

function safeText(value, { name = 'value', min = 1, max = 200, pattern } = {}) {
  const text = String(value ?? '').trim();
  if (text.length < min || text.length > max || (pattern && !pattern.test(text))) {
    throw Object.assign(new Error(`${name} is invalid.`), { status: 400 });
  }
  return text;
}

function finiteScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < -1e9 || score > 1e9) {
    throw Object.assign(new Error('Score is invalid.'), { status: 400 });
  }
  return score;
}

module.exports = {
  finiteScore,
  publicName,
  readJson,
  requestOriginAllowed,
  safeText,
  sendJson,
  supabaseRest,
  verifyPhuzeSession,
};
