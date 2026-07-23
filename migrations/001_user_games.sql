-- PlayFeed Script 投稿功能
-- 這是增量 migration，不會刪除既有 likes/comments/scores/saves/remixes。

create table if not exists public.user_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  suggested_id text,
  api_version int not null default 1,
  game_version text not null default '1.0.0',
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 240),
  tip text not null check (char_length(tip) between 1 and 160),
  bg text not null default '#18354a',
  tags jsonb not null default '[]',
  controls jsonb not null default '[]',
  duration int not null check (duration between 20 and 60),
  score jsonb not null default '{}',
  remix_slots jsonb not null default '[]',
  script text not null check (char_length(script) between 1 and 150000),
  screenshot text,
  author_id text not null,
  author_name text not null default '玩家',
  status text not null default 'published' check (status in ('draft', 'published', 'hidden', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_games_status_created_idx
  on public.user_games (status, created_at desc);
create index if not exists user_games_author_idx
  on public.user_games (author_id, created_at desc);

create table if not exists public.user_game_scores (
  game_id uuid not null references public.user_games(id) on delete cascade,
  game_version text not null,
  user_id text not null,
  score double precision not null check (score between -1000000000 and 1000000000),
  updated_at timestamptz not null default now(),
  primary key (game_id, game_version, user_id)
);

create index if not exists user_game_scores_rank_idx
  on public.user_game_scores (game_id, game_version, score);

alter table public.user_games enable row level security;
alter table public.user_game_scores enable row level security;

-- 與目前 PlayFeed 的 Phuze + Supabase 原型政策一致。
-- 正式開放公測前，應改成由驗證 Phuze session 的後端 API 寫入。
drop policy if exists "read published user games" on public.user_games;
create policy "read published user games" on public.user_games
  for select using (status = 'published');

drop policy if exists "write user games" on public.user_games;
create policy "write user games" on public.user_games
  for insert with check (true);

drop policy if exists "update user games" on public.user_games;
create policy "update user games" on public.user_games
  for update using (true) with check (true);

drop policy if exists "read user game scores" on public.user_game_scores;
create policy "read user game scores" on public.user_game_scores
  for select using (true);

drop policy if exists "write user game scores" on public.user_game_scores;
create policy "write user game scores" on public.user_game_scores
  for insert with check (true);

drop policy if exists "update user game scores" on public.user_game_scores;
create policy "update user game scores" on public.user_game_scores
  for update using (true) with check (true);
