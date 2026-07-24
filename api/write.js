const {
  finiteScore,
  publicName,
  readJson,
  requestOriginAllowed,
  safeText,
  sendJson,
  supabaseRest,
  verifyPhuzeSession,
} = require('./_lib');
const { validatePublishedScript } = require('./_validate');

const DISLIKE_PREFIX = '__dislike__:';
const FOLLOW_PREFIX = '__follow__:';
const PROFILE_PREFIX = '__profile__:';
const OFFICIAL_GAME_IDS = [
  'dodge', 'boba', 'timing', 'bubble', 'stack', 'mole', 'redlight',
  'slice', 'react', 'sheep', 'pixel-guess', 'potato-peel',
  'crossy-chicken', 'softserve',
];
const OFFICIAL_BACKGROUNDS = {
  dodge: '#65C7C4',
  boba: '#FFD6A5',
  timing: '#8176F2',
  bubble: '#5CC9E4',
  stack: '#B99CF2',
  mole: '#83D475',
  redlight: '#FFE08A',
  slice: '#FF8C7E',
  react: '#FFACC7',
  sheep: '#8FD8FF',
  'pixel-guess': '#70D899',
  'potato-peel': '#FFD2A1',
  'crossy-chicken': '#91DF72',
  softserve: '#FFB7D2',
};
const recentRequests = new Map();

function rateLimit(request, userId, action) {
  const key = `${request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown'}:${userId}:${action}`;
  const now = Date.now();
  const entry = recentRequests.get(key) || { start: now, count: 0 };
  if (now - entry.start > 60_000) {
    entry.start = now;
    entry.count = 0;
  }
  entry.count += 1;
  recentRequests.set(key, entry);
  if (recentRequests.size > 2_000) {
    for (const [oldKey, old] of recentRequests) {
      if (now - old.start > 120_000) recentRequests.delete(oldKey);
    }
  }
  return entry.count <= (action === 'score' || action === 'user-game-score' ? 120 : 40);
}

function encodeEq(value) {
  return encodeURIComponent(`eq.${value}`);
}

function validGameId(value) {
  return safeText(value, {
    name: 'gameId',
    max: 180,
    pattern: /^[\w:@.-]+$/u,
  });
}

function cleanStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) throw Object.assign(new Error('Invalid list.'), { status: 400 });
  return value.map(item => safeText(item, { max: maxLength }));
}

function cleanDataImage(value, maxLength = 450_000) {
  if (value === null || value === undefined || value === '') return null;
  const image = String(value);
  if (image.length > maxLength || !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(image)) {
    throw Object.assign(new Error('Image data is invalid or too large.'), { status: 400 });
  }
  return image;
}

async function replaceReaction(user, body) {
  const gameId = validGameId(body.gameId);
  const reaction = body.reaction === null ? null : safeText(body.reaction, { max: 7 });
  if (reaction !== null && reaction !== 'like' && reaction !== 'dislike') {
    throw Object.assign(new Error('Reaction is invalid.'), { status: 400 });
  }
  for (const key of [gameId, `${DISLIKE_PREFIX}${gameId}`]) {
    const removed = await supabaseRest('likes', {
      method: 'DELETE',
      query: `game_id=${encodeEq(key)}&user_id=${encodeEq(user.id)}`,
    });
    if (!removed.ok) throw Object.assign(new Error(removed.error), { status: removed.status });
  }
  if (reaction) {
    const inserted = await supabaseRest('likes', {
      method: 'POST',
      body: {
        game_id: reaction === 'dislike' ? `${DISLIKE_PREFIX}${gameId}` : gameId,
        user_id: user.id,
      },
      prefer: 'return=representation',
    });
    if (!inserted.ok) throw Object.assign(new Error(inserted.error), { status: inserted.status });
  }
  return { reaction };
}

async function replaceSave(user, body) {
  const gameId = validGameId(body.gameId);
  const active = body.active === true;
  const removed = await supabaseRest('saves', {
    method: 'DELETE',
    query: `game_id=${encodeEq(gameId)}&user_id=${encodeEq(user.id)}`,
  });
  if (!removed.ok) throw Object.assign(new Error(removed.error), { status: removed.status });
  if (active) {
    const inserted = await supabaseRest('saves', {
      method: 'POST',
      body: { game_id: gameId, user_id: user.id },
      prefer: 'return=representation',
    });
    if (!inserted.ok) throw Object.assign(new Error(inserted.error), { status: inserted.status });
  }
  return { active };
}

async function replaceFollow(user, body) {
  const authorId = safeText(body.authorId, { name: 'authorId', max: 180 });
  if (authorId === user.id) throw Object.assign(new Error('You cannot follow yourself.'), { status: 400 });
  const gameId = `${FOLLOW_PREFIX}${authorId}`;
  const active = body.active === true;
  const removed = await supabaseRest('likes', {
    method: 'DELETE',
    query: `game_id=${encodeEq(gameId)}&user_id=${encodeEq(user.id)}`,
  });
  if (!removed.ok) throw Object.assign(new Error(removed.error), { status: removed.status });
  if (active) {
    const inserted = await supabaseRest('likes', {
      method: 'POST',
      body: { game_id: gameId, user_id: user.id },
      prefer: 'return=representation',
    });
    if (!inserted.ok) throw Object.assign(new Error(inserted.error), { status: inserted.status });
  }
  return { active };
}

async function updateProfile(user, body) {
  const displayName = safeText(body.displayName || publicName(user), {
    name: 'display name',
    max: 30,
  });
  const bio = safeText(body.bio || '', { name: 'bio', min: 0, max: 120 });
  let website = String(body.website || '').trim();
  if (website) {
    if (website.length > 120) throw Object.assign(new Error('Website address is too long.'), { status: 400 });
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      website = parsed.toString();
      if (website.length > 120) throw new Error();
    } catch {
      throw Object.assign(new Error('Website address is invalid.'), { status: 400 });
    }
  }
  const profile = { display_name: displayName, bio, website };
  const storedProfile = JSON.stringify({ d: displayName, b: bio, w: website });
  if (storedProfile.length > 300) {
    throw Object.assign(new Error('Profile text contains too many special characters.'), { status: 400 });
  }
  const gameId = `${PROFILE_PREFIX}${user.id}`;
  const removed = await supabaseRest('comments', {
    method: 'DELETE',
    query: `game_id=${encodeEq(gameId)}&user_id=${encodeEq(user.id)}`,
  });
  if (!removed.ok) throw Object.assign(new Error(removed.error), { status: removed.status });
  const result = await supabaseRest('comments', {
    method: 'POST',
    body: {
      game_id: gameId,
      user_id: user.id,
      name: displayName,
      body: storedProfile,
    },
    prefer: 'return=representation',
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  return { profile };
}

async function createComment(user, body) {
  const row = {
    game_id: validGameId(body.gameId),
    user_id: user.id,
    name: publicName(user),
    body: safeText(body.body, { name: 'comment', max: 300 }),
  };
  const result = await supabaseRest('comments', {
    method: 'POST',
    body: row,
    prefer: 'return=representation',
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  return { comment: Array.isArray(result.data) ? result.data[0] : result.data };
}

async function submitScore(user, body) {
  const row = {
    game_id: validGameId(body.gameId),
    user_id: user.id,
    score: finiteScore(body.score),
    updated_at: new Date().toISOString(),
  };
  const result = await supabaseRest('scores', {
    method: 'POST',
    query: 'on_conflict=game_id,user_id',
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  return { score: row.score };
}

async function createRemix(user, body) {
  const source = body.sprites;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw Object.assign(new Error('Sprites are invalid.'), { status: 400 });
  }
  const entries = Object.entries(source);
  if (!entries.length || entries.length > 8) throw Object.assign(new Error('Sprites are invalid.'), { status: 400 });
  const sprites = {};
  let totalLength = 0;
  for (const [key, value] of entries) {
    const cleanKey = safeText(key, { name: 'sprite key', max: 40, pattern: /^[\w-]+$/u });
    const image = cleanDataImage(value, 450_000);
    totalLength += image.length;
    if (totalLength > 650_000) throw Object.assign(new Error('Images are too large.'), { status: 413 });
    sprites[cleanKey] = image;
  }
  const row = {
    base_id: validGameId(body.baseId),
    user_id: user.id,
    name: safeText(body.name, { name: 'name', max: 40 }),
    author: publicName(user),
    sprites,
  };
  const result = await supabaseRest('remixes', {
    method: 'POST',
    body: row,
    prefer: 'return=representation',
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  return { remix: Array.isArray(result.data) ? result.data[0] : result.data };
}

function cleanScoreConfig(value) {
  const score = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    label: safeText(score.label || '分數', { name: 'score label', max: 30 }),
    order: score.order === 'lower' ? 'lower' : 'higher',
  };
}

function cleanRemixSlots(value) {
  if (!Array.isArray(value) || value.length > 8) throw Object.assign(new Error('Remix slots are invalid.'), { status: 400 });
  return value.map(slot => ({
    key: safeText(slot?.key, { name: 'slot key', max: 40, pattern: /^[\w-]+$/u }),
    label: safeText(slot?.label, { name: 'slot label', max: 40 }),
    hint: safeText(slot?.hint || slot?.label, { name: 'slot hint', max: 100 }),
    default: safeText(slot?.default || '🎮', { name: 'slot default', max: 20 }),
    shape: safeText(slot?.shape || 'square', { name: 'slot shape', max: 20 }),
  }));
}

function slugBase(value) {
  const source = String(value || 'game').toLowerCase().trim();
  const slug = source.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 60);
  return slug || `game-${Date.now().toString(36)}`;
}

async function insertPublishedGame(user, rawGame) {
  if (!rawGame || typeof rawGame !== 'object') throw Object.assign(new Error('Game is invalid.'), { status: 400 });
  const script = String(rawGame.script || '');
  if (!script || script.length > 150_000) throw Object.assign(new Error('Script is invalid or too large.'), { status: 400 });
  const scriptErrors = await validatePublishedScript(script);
  if (scriptErrors.length) {
    throw Object.assign(new Error(`Script validation failed: ${scriptErrors.slice(0, 3).join(' ')}`), { status: 400 });
  }
  const requestedDuration = Number(rawGame.duration);
  const duration = Number.isInteger(requestedDuration) && requestedDuration >= 20 && requestedDuration <= 60
    ? requestedDuration
    : 45;
  const base = slugBase(rawGame.suggested_id || rawGame.slug);
  const common = {
    suggested_id: safeText(rawGame.suggested_id || base, { name: 'suggested ID', max: 80 }),
    api_version: 1,
    game_version: safeText(rawGame.game_version || '1.0.0', {
      name: 'game version',
      max: 30,
      pattern: /^[a-z0-9._-]+$/i,
    }),
    title: safeText(rawGame.title, { name: 'title', max: 80 }),
    description: safeText(rawGame.description, { name: 'description', max: 240 }),
    tip: safeText(rawGame.tip, { name: 'tip', max: 160 }),
    bg: safeText(rawGame.bg || '#18354a', {
      name: 'background',
      max: 30,
      pattern: /^(#[0-9a-f]{3,8}|[a-z]+)$/i,
    }),
    tags: cleanStringArray(rawGame.tags || [], 12, 30),
    controls: cleanStringArray(rawGame.controls || [], 8, 30),
    duration,
    score: cleanScoreConfig(rawGame.score),
    remix_slots: cleanRemixSlots(rawGame.remix_slots || []),
    script,
    screenshot: cleanDataImage(rawGame.screenshot, 500_000),
    author_id: user.id,
    author_name: publicName(user),
    status: 'published',
  };

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const result = await supabaseRest('user_games', {
      method: 'POST',
      body: { ...common, slug },
      prefer: 'return=representation',
    });
    if (result.ok) {
      const game = Array.isArray(result.data) ? result.data[0] : result.data;
      return { game: { ...game, storage_mode: 'user_games' } };
    }
    if (result.status !== 409) throw Object.assign(new Error(result.error), { status: result.status });
  }
  throw Object.assign(new Error('Could not create a unique game address.'), { status: 409 });
}

async function syncOfficialGames(user, body) {
  const existing = await supabaseRest('user_games', {
    query: 'select=author_id&order=created_at.asc&limit=1',
  });
  if (!existing.ok) throw Object.assign(new Error(existing.error), { status: existing.status });
  const firstAuthor = Array.isArray(existing.data) ? existing.data[0]?.author_id : null;
  if (firstAuthor && firstAuthor !== user.id) {
    throw Object.assign(new Error('Only the PlayFeed owner can synchronize official games.'), { status: 403 });
  }

  const submitted = Array.isArray(body.games) ? body.games : [];
  if (submitted.length !== OFFICIAL_GAME_IDS.length) {
    throw Object.assign(new Error('The official game package is incomplete.'), { status: 400 });
  }
  const byId = new Map(submitted.map(game => [String(game?.id || ''), game]));
  if (byId.size !== OFFICIAL_GAME_IDS.length || OFFICIAL_GAME_IDS.some(id => !byId.has(id))) {
    throw Object.assign(new Error('The official game package does not match PlayFeed.'), { status: 400 });
  }

  const rows = OFFICIAL_GAME_IDS.map((id, index) => {
    const game = byId.get(id);
    const script = safeText(game.script, { name: 'official script', max: 150_000 });
    if (!script.includes('window.GAMES') || !script.includes('create(env)')) {
      throw Object.assign(new Error(`Official game ${id} has an invalid Script.`), { status: 400 });
    }
    return {
      slug: id,
      suggested_id: id,
      api_version: 1,
      game_version: 'official-1.0.0',
      title: safeText(game.title, { name: 'title', max: 80 }),
      description: safeText(game.description || game.tip, { name: 'description', max: 240 }),
      tip: safeText(game.tip, { name: 'tip', max: 160 }),
      bg: OFFICIAL_BACKGROUNDS[id],
      tags: cleanStringArray(game.tags || ['official'], 12, 30),
      controls: cleanStringArray(game.controls || ['tap'], 8, 30),
      duration: 45,
      score: cleanScoreConfig(game.score),
      remix_slots: cleanRemixSlots(game.remix_slots || []),
      script,
      screenshot: null,
      author_id: user.id,
      author_name: publicName(user),
      status: 'published',
      created_at: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  const result = await supabaseRest('user_games', {
    method: 'POST',
    query: 'on_conflict=slug',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  return { games: result.data };
}

async function submitUserGameScore(user, body) {
  const score = finiteScore(body.score);
  if (body.storageMode === 'remixes') {
    return submitScore(user, { gameId: validGameId(body.scoreKey), score });
  }
  const gameId = safeText(body.databaseId, {
    name: 'database game ID',
    max: 50,
    pattern: /^[0-9a-f-]{36}$/i,
  });
  const gameVersion = safeText(body.gameVersion || '1.0.0', {
    name: 'game version',
    max: 30,
    pattern: /^[a-z0-9._-]+$/i,
  });
  const row = {
    game_id: gameId,
    game_version: gameVersion,
    user_id: user.id,
    score,
    updated_at: new Date().toISOString(),
  };
  const result = await supabaseRest('user_game_scores', {
    method: 'POST',
    query: 'on_conflict=game_id,game_version,user_id',
    body: row,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  return { score };
}

const actions = {
  reaction: replaceReaction,
  follow: replaceFollow,
  profile: updateProfile,
  save: replaceSave,
  comment: createComment,
  score: submitScore,
  remix: createRemix,
  'publish-game': (user, body) => insertPublishedGame(user, body.game),
  'sync-official-games': syncOfficialGames,
  'user-game-score': submitUserGameScore,
};

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  if (!requestOriginAllowed(request)) return sendJson(response, 403, { error: 'Origin not allowed.' });

  try {
    const body = await readJson(request);
    const action = String(body.action || '');
    const perform = actions[action];
    if (!perform) return sendJson(response, 400, { error: 'Unknown action.' });

    const verified = await verifyPhuzeSession(request);
    if (verified.error) return sendJson(response, verified.error.status, { error: verified.error.message });
    if (!rateLimit(request, verified.user.id, action)) {
      return sendJson(response, 429, { error: 'Too many requests. Please wait a moment.' });
    }

    const data = await perform(verified.user, body);
    return sendJson(response, 200, { ok: true, ...data });
  } catch (error) {
    return sendJson(response, Number(error.status) || 500, {
      error: Number(error.status) && Number(error.status) < 500
        ? error.message
        : 'The request could not be completed.',
    });
  }
};
