(() => {
  // Phuze's documented custom login flow: /auth/magic-link + /sessions/pickup.
  const tokenKey = 'phuze_session';
  const pendingKey = 'playfeed:phuze-pending';
  const state = { user: null, token: '', ready: false, pending: null, collection: null, listeners: new Set() };
  let initialized = false, pendingLogin = null, pickupTimer, pickupBusy = false, refreshBusy = null, revision = 0;
  let form, input, button, status, cooldownTimer, cooldownUntil = 0, inline = false;

  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function write(key, value) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); return true; }
    catch { return false; }
  }
  function emit() {
    for (const listener of state.listeners) {
      try { listener(state.user); } catch (error) { console.error('PlayFeed login UI failed:', error?.name || 'Error'); }
    }
  }
  function message(text) { if (status) status.textContent = text; }
  function renderButton() {
    if (!button) return;
    const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
    button.disabled = Boolean(form?.dataset.sending) || remaining > 0;
    button.textContent = form?.dataset.sending ? '寄送中…' : remaining ? remaining + (inline ? ' 秒後重送' : ' 秒後可重新寄送') : inline ? '連結' : '寄送認證連結';
    if (remaining) cooldownTimer = setTimeout(renderButton, 1000);
  }
  function cooldown(seconds) {
    clearTimeout(cooldownTimer);
    cooldownUntil = Date.now() + Math.max(1, seconds) * 1000;
    renderButton();
  }
  function errorMessage(error) {
    if (error.status === 429) {
      if (error.code === 'quota_exceeded') return '認證服務今日寄信額度已滿，請稍後再試。';
      return '寄信次數暫時受限，請等待 ' + (error.retryAfter || 60) + ' 秒再試。';
    }
    if (error.status === 403) return '認證服務拒絕這個網站的請求，請回報給管理者。';
    if (error.status === 401) return '認證已失效，請重新寄送認證連結。';
    if (error.name === 'AbortError') return '認證服務回應逾時，請稍後再試。';
    if (error instanceof TypeError) return '無法連線認證服務，請稍後再試。';
    return error.message || '無法連線認證服務，請稍後再試。';
  }
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.error;
        const error = new Error(typeof detail === 'string' ? detail : detail?.message || '認證服務暫時無法回應。');
        error.status = response.status;
        error.code = detail?.code;
        error.retryAfter = Number(detail?.retry_after_seconds || data.retry_after_seconds || response.headers.get('Retry-After')) || 60;
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  function phuze(path, options = {}) {
    let body;
    if (path === '/auth/magic-link') {
      const values = JSON.parse(options.body);
      body = { action: 'send', email: values.email, pendingId: values.pending_id };
    } else if (path.startsWith('/sessions/pickup?')) {
      body = { action: 'pickup', pendingId: new URLSearchParams(path.split('?')[1]).get('pending_id') };
    } else if (path === '/sessions/logout') {
      body = { action: 'logout', token: options.headers['X-Session-Token'] };
    } else return Promise.reject(new Error('認證操作無效。'));
    return request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function clearPending() {
    clearTimeout(pickupTimer);
    state.pending = null;
    write(pendingKey, null);
  }
  function loadPending() {
    try {
      const pending = JSON.parse(read(pendingKey) || 'null');
      if (pending && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pending.id)
          && Number.isFinite(pending.created) && Date.now() - pending.created < 600000) state.pending = pending;
    } catch {}
  }
  async function acceptToken(token) {
    const turn = revision;
    const collectionBootstrap = !state.user && document.querySelector('meta[name="playfeed-auth-bootstrap"]')?.content === 'collection';
    const data = await request(collectionBootstrap ? '/api/account?action=collection' : '/api/auth', { headers: { Authorization: 'Bearer ' + token } });
    if (turn !== revision || !data.user?.id) return;
    const changed = state.token !== token || state.user?.id !== data.user.id;
    if (collectionBootstrap) state.collection = data;
    state.token = token;
    state.user = data.user;
    state.ready = true;
    const persisted = write(tokenKey, token);
    clearPending();
    message(persisted ? 'Email 認證完成。' : 'Email 認證完成；此瀏覽器無法保存認證狀態，關閉分頁後可能需要重新認證。');
    if (changed) emit();
    document.querySelector('#login-dialog')?.close();
    const action = pendingLogin; pendingLogin = null;
    if (action) Promise.resolve().then(action).catch(error => message(errorMessage(error)));
  }
  async function refresh() {
    if (refreshBusy) return refreshBusy;
    refreshBusy = (async () => {
      const token = read(tokenKey) || state.token;
      if (!token) return;
      try { await acceptToken(token); }
      catch (error) {
        if (error.status === 401) {
          state.token = ''; state.user = null; state.collection = null; write(tokenKey, null); emit();
        }
        message(errorMessage(error));
      }
    })();
    try { await refreshBusy; } finally { refreshBusy = null; state.ready = true; if (!state.user) emit(); }
  }
  async function pickup() {
    clearTimeout(pickupTimer);
    if (pickupBusy || !state.pending) return;
    const pending = state.pending, turn = revision;
    if (Date.now() - pending.created >= 600000) {
      clearPending(); message('這次認證等待已逾時，請重新寄送連結。'); return;
    }
    pickupBusy = true;
    let delay = 2200;
    try {
      const data = await phuze('/sessions/pickup?pending_id=' + encodeURIComponent(pending.id));
      if (turn !== revision || state.pending?.id !== pending.id) return;
      if (data.ready && typeof data.session_token === 'string' && data.session_token) {
        // Pickup is one-time: preserve the token before verifying, even if that request fails.
        revision++;
        state.token = data.session_token; write(tokenKey, data.session_token);
        clearPending();
        try { await acceptToken(data.session_token); }
        catch (error) { message(errorMessage(error)); pickupTimer = setTimeout(refresh, 5000); }
        return;
      }
    } catch (error) {
      if (turn !== revision || state.pending?.id !== pending.id) return;
      message(errorMessage(error));
      if (error.status === 429) delay = Math.max(2200, error.retryAfter * 1000);
      else if (error.status === 403) { clearPending(); return; }
      else delay = 5000;
    } finally {
      pickupBusy = false;
      if (turn === revision && state.pending?.id === pending.id) pickupTimer = setTimeout(pickup, delay);
    }
  }
  async function send(event) {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    if (!crypto.randomUUID) { message('此瀏覽器不支援安全認證，請更新瀏覽器後再試。'); return; }
    form.dataset.sending = 'true'; renderButton(); message('正在寄送認證連結…');
    const previous = state.pending;
    const pending = { id: crypto.randomUUID(), created: Date.now() };
    try {
      // Keep the previous handoff usable until a new email has actually been accepted.
      await phuze('/auth/magic-link', { method: 'POST', body: JSON.stringify({
        email: input.value.trim(), pending_id: pending.id,
        redirect_url: location.origin + '/account.html', locale: 'zh-TW'
      }) });
      state.pending = pending;
      const persisted = write(pendingKey, JSON.stringify(pending));
      message('認證信已送出，請去收信。點完連結後，回到這個分頁即可同步收藏。'
        + (persisted ? '' : '請保留此分頁，不要重新整理。'));
      cooldown(60);
      pickup();
    } catch (error) {
      state.pending = previous;
      message(errorMessage(error));
      if (error.status === 429) cooldown(error.retryAfter);
    } finally { delete form.dataset.sending; renderButton(); }
  }
  function openLogin(afterLogin) {
    window.PlayFeedAnalytics?.event('login_open');
    pendingLogin = typeof afterLogin === 'function' ? afterLogin : null;
    const dialog = document.querySelector('#login-dialog');
    if (dialog && !dialog.open) dialog.showModal();
    if (!dialog) input?.focus();
    refresh().then(() => { if (!state.user && state.pending) pickup(); });
  }
  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.token) headers.set('Authorization', 'Bearer ' + state.token);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    try { return await request(path, { ...options, headers }); }
    catch (error) {
      if (error.status === 401 && state.user) {
        revision++; state.user = null; state.token = ''; state.collection = null; write(tokenKey, null); emit();
      }
      throw error;
    }
  }
  function requireLogin(action) {
    if (state.user && state.token) { action?.(); return true; }
    openLogin(action); return false;
  }
  async function logout() {
    const token = state.token || read(tokenKey);
    if (token) await phuze('/sessions/logout', { method: 'POST', headers: { 'X-Session-Token': token } });
    revision++; state.token = ''; state.user = null; state.collection = null; pendingLogin = null;
    clearPending(); write(tokenKey, null); message('已登出。'); emit();
  }
  function resume() {
    if (document.visibilityState === 'hidden') return;
    refresh().then(() => { if (!state.user) { if (!state.pending) loadPending(); if (state.pending) pickup(); } });
  }
  function init() {
    if (initialized) return;
    initialized = true;
    const dialog = document.querySelector('#login-dialog'), host = document.querySelector('#phuze-inline-widget') || document.querySelector('#phuze-widget');
    dialog?.querySelector('[data-close-login]')?.addEventListener('click', () => { pendingLogin = null; dialog.close(); });
    if (host) {
      inline = host.id === 'phuze-inline-widget';
      host.replaceChildren();
      form = document.createElement('form'); form.className = 'phuze-form';
      input = document.createElement('input'); input.type = 'email'; input.required = true;
      input.placeholder = inline ? '連結email，每個瀏覽器都可以取得自己的收藏' : 'name@example.com'; input.autocomplete = 'email'; input.inputMode = 'email';
      input.setAttribute('aria-label', '認證 Email'); input.className = 'phuze-input';
      button = document.createElement('button'); button.type = 'submit'; button.className = 'phuze-btn';
      status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      status.style.cssText = 'white-space:normal;line-height:1.6;font-size:14px;overflow-wrap:anywhere';
      input.style.cssText = 'display:block;box-sizing:border-box;width:100%;min-width:0;padding:12px;border:1px solid #555;border-radius:12px;background:#25252d;color:inherit;font:inherit;font-size:16px';
      button.style.cssText = 'width:100%;margin-top:12px;background:#d6fb65;color:#101014;padding:12px;border:0;border-radius:12px;font:inherit;white-space:normal';
      if (inline) {
        form.dataset.emailHint = input.placeholder;
        form.style.cssText = 'display:flex;align-items:center;gap:8px;position:relative';
        input.style.cssText = 'display:block;box-sizing:border-box;flex:1;width:100%;min-width:0;height:44px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;font-size:16px';
        button.style.cssText = 'flex:none;min-width:76px;height:40px;padding:0 14px;border:0;border-radius:9px;background:#e8b17e;color:#402815;font:700 13px system-ui;white-space:nowrap';
        status.className = 'phuze-inline-status';
      }
      form.append(input, button); host.append(form, status);
      if (!inline) {
        const credit = document.createElement('p');
        credit.className = 'phuze-credit';
        credit.style.cssText = 'margin:16px 0 0;font-size:12px;color:#aaa8b3;line-height:1.6;text-align:center';
        const provider = document.createElement('a');
        provider.href = 'https://phuze.edato.me/'; provider.target = '_blank'; provider.rel = 'noopener noreferrer';
        provider.textContent = 'Phuze'; provider.style.cssText = 'color:inherit;text-decoration:underline;text-underline-offset:3px';
        credit.append('採用 ', provider, ' 快速認證系統'); host.append(credit);
      }
      form.addEventListener('submit', send); renderButton();
    }
    loadPending(); resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('storage', event => {
      if (event.key !== tokenKey) return;
      revision++;
      if (!event.newValue) { state.user = null; state.token = ''; state.collection = null; emit(); }
      else refresh();
    });
  }
  window.PlayFeedAuth = {
    api, init, openLogin, requireLogin, logout,
    onChange(listener) { state.listeners.add(listener); listener(state.user); return () => state.listeners.delete(listener); },
    takeCollection() { const data = state.collection; state.collection = null; return data; },
    get checking() { return !state.ready && Boolean(read(tokenKey) || state.token); },
    get user() { return state.user; }, get token() { return state.token; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
