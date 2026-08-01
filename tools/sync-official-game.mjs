import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const [fileArgument, createdAtArgument] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || 'oimdeoszgxfumwtmapok';
if (!fileArgument || !createdAtArgument) {
  throw new Error('Usage: node tools/sync-official-game.mjs <game-file.js> <created-at-iso>');
}
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required.');

const file = path.resolve(fileArgument);
const source = fs.readFileSync(file, 'utf8');
if (source.includes('$playfeed_script$')) throw new Error('Script contains the reserved SQL delimiter.');
const sandbox = { window: { GAMES: [] }, Math };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: file });
if (sandbox.window.GAMES.length !== 1) throw new Error('The file must register exactly one game.');
const game = sandbox.window.GAMES[0];

function literal(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || result?.error || `Supabase returned ${response.status}`);
  return result;
}

const authors = await query(`
  select author_id, author_name
  from public.user_games
  where slug = 'dodge'
  limit 1;
`);
const author = authors?.[0];
if (!author?.author_id) throw new Error('Could not identify the existing PlayFeed owner.');

const version = `official-${game.gameVersion || '1.0.0'}`;
const score = game.score || { label: '分數', order: 'higher' };
const sql = `
  insert into public.user_games (
    slug, suggested_id, api_version, game_version, title, description, tip, bg,
    tags, controls, duration, score, remix_slots, script, screenshot,
    author_id, author_name, status, created_at, updated_at
  ) values (
    ${literal(game.id)}, ${literal(game.id)}, 1, ${literal(version)},
    ${literal(game.title)}, ${literal(game.description || game.tip)}, ${literal(game.tip)}, ${literal(game.bg)},
    ${literal(JSON.stringify(game.tags || ['official']))}::jsonb,
    ${literal(JSON.stringify(game.controls || ['tap']))}::jsonb,
    ${Math.min(60, Math.max(20, Number(game.duration) || 45))},
    ${literal(JSON.stringify(score))}::jsonb,
    ${literal(JSON.stringify(game.remixSlots || []))}::jsonb,
    $playfeed_script$${source}$playfeed_script$,
    null, ${literal(author.author_id)}, ${literal(author.author_name || '我')},
    'published', ${literal(createdAtArgument)}::timestamptz, now()
  )
  on conflict (slug) do update set
    suggested_id = excluded.suggested_id,
    api_version = excluded.api_version,
    game_version = excluded.game_version,
    title = excluded.title,
    description = excluded.description,
    tip = excluded.tip,
    bg = excluded.bg,
    tags = excluded.tags,
    controls = excluded.controls,
    duration = excluded.duration,
    score = excluded.score,
    remix_slots = excluded.remix_slots,
    script = excluded.script,
    author_id = excluded.author_id,
    author_name = excluded.author_name,
    status = excluded.status,
    created_at = excluded.created_at,
    updated_at = now()
  returning slug, title, game_version, author_name, created_at;
`;
const rows = await query(sql);
console.log(JSON.stringify(rows?.[0] || null));
