const { sendJson, verifyPhuzeSession, requestOriginAllowed } = require('./_lib');
module.exports = async (request, response) => {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  if (!requestOriginAllowed(request)) return sendJson(response, 403, { error: 'Origin not allowed.' });
  try {
    const result = await verifyPhuzeSession(request);
    if (result.error) return sendJson(response, result.error.status, { error: result.error.message });
    return sendJson(response, 200, { user: result.user });
  } catch {
    return sendJson(response, 502, { error: '登入驗證服務暫時無法連線，請稍後再試。' });
  }
};
