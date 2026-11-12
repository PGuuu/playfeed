(() => {
  const publishableKey = 'pk_live_bzqxC3-qVXRR7AtDgMaTeXiapC-PMPVd';
  const state = { user: null, token: '', ready: false, listeners: new Set(), pending: null };

  function tokenFrom(session) {
    return String(session?.token || session?.sessionToken || session?.accessToken || localStorage.getItem('phuze_session') || '');
  }

  function emit() {
    for (const listener of state.listeners) listener(state.user);
  }

  function openLogin(afterLogin) {
    state.pending = typeof afterLogin === 'function' ? afterLogin : null;
    const dialog = document.querySelector('#login-dialog');
    if (dialog && !dialog.open) dialog.showModal();
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        state.user = null;
        state.token = '';
        emit();
      }
      throw new Error(data.error || '操作失敗，請稍後再試。');
    }
    return data;
  }

  function requireLogin(action) {
    if (state.user && state.token) {
      action?.();
      return true;
    }
    openLogin(action);
    return false;
  }

  function init() {
    const dialog = document.querySelector('#login-dialog');
    dialog?.querySelector('[data-close-login]')?.addEventListener('click', () => dialog.close());
    if (!window.Phuze) {
      state.ready = true;
      emit();
      return;
    }
    Phuze.init({
      publishableKey,
      locale: document.documentElement.lang === 'en' ? 'en' : 'zh-TW',
      text: {
        button: '寄登入連結給我', buttonLoading: '寄送中…', buttonSignOut: '登出',
        placeholder: 'name@example.com', sentTitle: '去收信！', sentSubtitle: '點信裡的連結，這個畫面會自動完成登入。'
      },
      theme: { accentColor: '#d6fb65', accentHoverColor: '#bde54f', accentTextColor: '#101014', borderRadius: '12px', borderColor: '#3c3c46' }
    });
    if (document.querySelector('#phuze-widget')) Phuze.mount('#phuze-widget');
    Phuze.onSessionChange(session => {
      state.token = session ? tokenFrom(session) : '';
      state.user = session ? { id: String(session.uid || session.id || ''), email: String(session.email || '') } : null;
      state.ready = true;
      emit();
      if (session) {
        dialog?.close();
        const pending = state.pending;
        state.pending = null;
        pending?.();
      }
    });
  }

  window.PlayFeedAuth = {
    api, init, openLogin, requireLogin,
    onChange(listener) { state.listeners.add(listener); listener(state.user); return () => state.listeners.delete(listener); },
    get user() { return state.user; },
    get token() { return state.token; },
    async logout() { if (window.Phuze) await Phuze.logout(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
