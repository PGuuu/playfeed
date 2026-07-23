-- PlayFeed 資料庫初始化（Phuze 會員版）
-- 使用方法：Supabase 後台左邊選 SQL Editor → New query → 整段貼上 → Run
-- 注意：如果之前跑過舊版 setup.sql，這段會先把舊表刪掉重建（舊資料會清空）。

drop table if exists public.likes cascade;
drop table if exists public.comments cascade;
drop table if exists public.scores cascade;
drop table if exists public.saves cascade;
drop table if exists public.remixes cascade;
drop table if exists public.user_game_scores cascade;
drop table if exists public.user_games cascade;

-- user_id 是 Phuze 發的會員編號（一串文字），不是 Supabase 自己的帳號系統
create table public.likes (
  id bigint generated always as identity primary key,
  game_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create table public.comments (
  id bigint generated always as identity primary key,
  game_id text not null,
  user_id text not null,
  name text not null default '玩家',
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create table public.scores (
  game_id text not null,
  user_id text not null,
  score int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

-- 收藏（儲存到「我的頁面」）
create table public.saves (
  id bigint generated always as identity primary key,
  game_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

-- Remix：玩家改造後發佈的新遊戲版本（sprites 是 {槽位: 圖片dataURL}）
create table public.remixes (
  id uuid primary key default gen_random_uuid(),
  base_id text not null,
  user_id text not null,
  name text not null,
  author text not null default '玩家',
  sprites jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 使用者投稿的完整 Script 與平台擷取 metadata
create table public.user_games (
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

-- 投稿遊戲依「遊戲 ID + 版本 + 玩家」分開保存最佳成績
create table public.user_game_scores (
  game_id uuid not null references public.user_games(id) on delete cascade,
  game_version text not null,
  user_id text not null,
  score double precision not null check (score between -1000000000 and 1000000000),
  updated_at timestamptz not null default now(),
  primary key (game_id, game_version, user_id)
);

alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.scores enable row level security;
alter table public.saves enable row level security;
alter table public.remixes enable row level security;
alter table public.user_games enable row level security;
alter table public.user_game_scores enable row level security;

-- 因為登入是 Phuze 管的，Supabase 這邊驗不了身分，
-- 所以政策先全開（適合小型社群實驗；要更嚴格的防偽造再跟 Claude 說，
-- 可以升級成用 Supabase Edge Function 驗 Phuze token）。
create policy "read likes" on public.likes for select using (true);

create policy "read comments" on public.comments for select using (true);

create policy "read scores" on public.scores for select using (true);

create policy "read saves" on public.saves for select using (true);

create policy "read remixes" on public.remixes for select using (true);

create policy "read published user games" on public.user_games for select using (status = 'published');

create policy "read user game scores" on public.user_game_scores for select using (true);

-- 瀏覽器只保留讀取權限。寫入必須經過 /api/write 驗證 Phuze 登入身分。
revoke insert, update, delete, truncate, references, trigger
  on public.likes, public.comments, public.scores, public.saves,
     public.remixes, public.user_games, public.user_game_scores
  from anon, authenticated;
