const { readJson, requestOriginAllowed, sendJson } = require('./_lib');
const provider = 'https://phuze.edato.me/api/v1';
const publishableKey = 'pk_live_bzqxC3-qVXRR7AtDgMaTeXiapC-PMPVd';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  // Only the same-origin UI may use this fixed provider relay.
  if (!request.headers.origin || !requestOriginAllowed(request)) return sendJson(response, 403, { error: 'Origin not allowed.' });
  let timer;
  try {
    const origin = new URL(request.headers.origin).origin;
    const body = await readJson(request, 4000);
    let path, payload, method = 'POST', session;
    if (body.action === 'send') {
      const email = String(body.email || '').trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !uuid.test(String(body.pendingId || ''))) return sendJson(response, 400, { error: 'Email 或登入請求格式不正確。' });
      path = '/auth/magic-link';
      payload = { email, pending_id: body.pendingId, redirect_url: origin + '/account.html', locale: 'zh-TW' };
    } else if (body.action === 'pickup') {
      if (!uuid.test(String(body.pendingId || ''))) return sendJson(response, 400, { error: '登入請求格式不正確。' });
      path = '/sessions/pickup?pending_id=' + encodeURIComponent(body.pendingId);
      method = 'GET';
    } else if (body.action === 'logout') {
      session = String(body.token || '');
      if (!session || session.length > 2000 || /[\r\n]/.test(session)) return sendJson(response, 400, { error: '登入憑證格式不正確。' });
      path = '/sessions/logout';
    } else return sendJson(response, 400, { error: 'Unknown login action.' });
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(provider + path, {
      method, signal: controller.signal,
      headers: { Authorization: 'Publishable ' + publishableKey, Origin: origin, 'Content-Type': 'application/json', ...(session ? { 'X-Session-Token': session } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const data = await upstream.json().catch(() => ({ error: '登入服務回應格式異常。' }));
    if (!upstream.ok) console.warn('Phuze login request failed', upstream.status, data.error?.code || 'provider_error');
    const retry = upstream.headers.get('Retry-After');
    if (retry && /^\d+$/.test(retry)) response.setHeader('Retry-After', retry);
    return sendJson(response, upstream.status, data);
  } catch {
    return sendJson(response, 502, { error: 'PlayFeed 暫時無法連線 Phuze，請稍後再試。' });
  } finally { clearTimeout(timer); }
};
