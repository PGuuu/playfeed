(() => {
  const dialog = document.querySelector('#wish-dialog');
  const form = dialog.querySelector('#wish-form');
  const list = dialog.querySelector('#wish-list');
  const status = dialog.querySelector('#wish-list-status');
  const feedback = dialog.querySelector('#wish-feedback');
  const more = dialog.querySelector('#wish-more');
  const submit = form.querySelector('button');
  const auth = window.PlayFeedAuth;
  const formatDate = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
  let next = null;
  let loading = false;
  let signedIn = false;

  auth.onChange(user => {
    signedIn = Boolean(user);
    form.querySelector('#wish-member').hidden = !signedIn;
    form.querySelector('#wish-guest').hidden = signedIn;
    if (!signedIn) form.elements.author.value = 'anonymous';
  });

  function renderPost(post) {
    const item = document.createElement('li');
    const header = document.createElement('div');
    const name = document.createElement('strong');
    const time = document.createElement('time');
    const body = document.createElement('p');
    item.dataset.id = post.id;
    name.textContent = post.display_name;
    if (post.is_member) {
      const badge = document.createElement('span');
      badge.className = 'wish-member-badge';
      badge.setAttribute('role', 'img');
      badge.setAttribute('aria-label', 'FanGame 會員');
      badge.title = 'FanGame 會員';
      name.append(' ', badge);
    }
    time.dateTime = post.created_at;
    time.textContent = formatDate.format(new Date(post.created_at));
    body.textContent = post.body;
    header.append(name, time);
    item.append(header, body);
    return item;
  }

  async function load() {
    if (loading) return;
    loading = true;
    more.hidden = true;
    status.textContent = '讀取留言中…';
    try {
      const response = await fetch('/api/account?action=wishes' + (next ? '&before=' + next : ''));
      if (!response.ok) throw new Error();
      const data = await response.json();
      for (const post of data.posts) {
        if (!list.querySelector('[data-id="' + post.id + '"]')) list.append(renderPost(post));
      }
      next = data.next;
      status.textContent = list.children.length ? '' : '還沒有留言，來分享第一個願望吧。';
      more.textContent = '載入更多';
      more.hidden = !next;
    } catch {
      status.textContent = '暫時無法讀取留言。';
      more.textContent = '重新載入';
      more.hidden = false;
    } finally {
      loading = false;
    }
  }

  document.querySelector('.wish-button').addEventListener('click', () => {
    dialog.showModal();
    if (!loading) {
      next = null;
      list.replaceChildren();
      load();
    }
  });
  more.addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const body = form.elements.body.value.trim();
    if (!body) {
      feedback.textContent = '請先寫下你的建議。';
      return;
    }
    const author = signedIn ? form.elements.author.value : 'anonymous';
    const payload = { action: 'wish', body, author, name: signedIn ? '' : form.elements.nickname.value };
    const options = { method: 'POST', body: JSON.stringify(payload) };
    submit.disabled = true;
    form.elements.body.readOnly = true;
    feedback.textContent = '送出中…';
    try {
      let data;
      if (author === 'member') {
        data = await auth.api('/api/account', options);
      } else {
        const response = await fetch('/api/account', { ...options, headers: { 'Content-Type': 'application/json' } });
        data = await response.json();
        if (!response.ok) throw new Error(data.error);
      }
      const existing = list.querySelector('[data-id="' + data.post.id + '"]');
      if (!existing) list.prepend(renderPost(data.post));
      status.textContent = '';
      form.elements.body.value = '';
      feedback.textContent = '留言已送出。';
    } catch (error) {
      feedback.textContent = error.status === 401 ? '登入已失效，請重新登入或匿名送出。' : '留言未送出，請再試一次。';
    } finally {
      form.elements.body.readOnly = false;
      submit.disabled = false;
    }
  });
})();
