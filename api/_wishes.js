const { supabaseRest } = require('./_lib');

const fields = 'id,display_name,body,created_at,is_member';
const pageSize = 20;

async function wishes(options) {
  const result = await supabaseRest('playfeed_wishes', options);
  if (!result.ok) throw Object.assign(new Error('許願板暫時無法使用，請稍後再試。'), { status: 503 });
  return result.data;
}

async function list(before) {
  if (before !== undefined && !/^[1-9]\d{0,15}$/.test(String(before))) {
    throw Object.assign(new Error('無法讀取這一頁。'), { status: 400 });
  }
  const cursor = before ? '&id=lt.' + before : '';
  const rows = await wishes({ query: 'select=' + fields + '&order=id.desc&limit=' + (pageSize + 1) + cursor });
  const posts = rows.slice(0, pageSize);
  return { posts, next: rows.length > pageSize ? posts.at(-1).id : null };
}

async function post(input, user) {
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const displayName = typeof input.name === 'string' ? input.name.trim() : '';
  if (!body || body.length > 1000 || displayName.length > 24 || /[\x00-\x1f\x7f]/.test(displayName) || body.includes('\0')) {
    throw Object.assign(new Error('請輸入 1 到 1000 字的建議，暱稱最多 24 字。'), { status: 400 });
  }
  const [post] = await wishes({
    method: 'POST',
    query: 'select=' + fields,
    body: {
      body,
      display_name: user ? (await require('./_community').profileFor(user)).display_name : displayName || '匿名',
      is_member: Boolean(user),
    },
    prefer: 'return=representation',
  });
  return { post };
}

module.exports = { list, post };
