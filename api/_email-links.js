const OWNERS = new Set(['paulvongulla@gmail.com', 'paulwu.hs10@nycu.edu.tw']);
let cached, cachedAt = 0, pending;
async function load() {
 const secret = process.env.PHUZE_SECRET_KEY || process.env.phuze_secret_key;
 if (!secret) throw Error('Email 連結名單暫時無法讀取。');
 const users = new Map(), cursors = new Set();
 let cursor = '', pages = 0;
 const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6000);
 try {
  do {
   if (++pages > 400 || cursors.has(cursor)) throw Error('Incomplete user directory');
   cursors.add(cursor);
   const url = new URL('https://phuze.edato.me/api/v1/clients/me/users');
   url.searchParams.set('limit', '25');
   if (cursor) url.searchParams.set('cursor', cursor);
   const response = await fetch(url, { headers: { Authorization: 'Secret ' + secret }, signal: controller.signal });
   if (!response.ok) throw Error('User directory unavailable');
   const data = await response.json();
   if (!Array.isArray(data.users) || !('next_cursor' in data) ||
       (data.next_cursor !== null && (typeof data.next_cursor !== 'string' || !data.next_cursor))) throw Error('Invalid user directory');
   for (const user of data.users) {
    if (typeof user.uid !== 'string' || !user.uid) throw Error('Invalid user identity');
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    users.set(user.uid, { uid: user.uid, email, first_seen_at: user.first_seen_at || null,
     last_active_at: user.last_active_at || null, login_count: Number.isSafeInteger(user.login_count) ? user.login_count : null,
     is_owner: OWNERS.has(email.toLowerCase()), is_test: email.toLowerCase() === 'paulvongulla+playfeedtest@gmail.com' });
   }
   cursor = data.next_cursor;
  } while (cursor !== null);
 } finally { clearTimeout(timer); }
 const rows = [...users.values()].sort((a,b) => (Date.parse(b.first_seen_at)||0) - (Date.parse(a.first_seen_at)||0));
 return { users: rows, total: rows.length, owners: rows.filter(user => user.is_owner).length, tests: rows.filter(user => user.is_test).length };
}
async function emailLinks() {
 if (cached && Date.now() - cachedAt < 60000) return cached;
 if (!pending) pending = load().then(result => { cached = result; cachedAt = Date.now(); return result; }).finally(() => { pending = null; });
 return pending;
}
module.exports = { emailLinks };
