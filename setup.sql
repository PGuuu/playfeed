-- PlayFeed 資料庫初始化（Phuze 會員版）
-- 使用方法：Supabase 後台左邊選 SQL Editor → New query → 整段貼上 → Run
-- 注意：如果之前跑過舊版 setup.sql，這段會先把舊表刪掉重建（舊資料會清空）。

drop table if exists public.likes cascade;
drop table if exists public.comments cascade;
drop table if exists public.scores cascade;
drop table if exists public.saves cascade;
drop table if exists public.remixes cascade;

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

alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.scores enable row level security;
alter table public.saves enable row level security;
alter table public.remixes enable row level security;

-- 因為登入是 Phuze 管的，Supabase 這邊驗不了身分，
-- 所以政策先全開（適合小型社群實驗；要更嚴格的防偽造再跟 Claude 說，
-- 可以升級成用 Supabase Edge Function 驗 Phuze token）。
create policy "read likes" on public.likes for select using (true);
create policy "write likes" on public.likes for insert with check (true);
create policy "remove likes" on public.likes for delete using (true);

create policy "read comments" on public.comments for select using (true);
create policy "write comments" on public.comments for insert with check (true);

create policy "read scores" on public.scores for select using (true);
create policy "write scores" on public.scores for insert with check (true);
create policy "update scores" on public.scores for update using (true) with check (true);

create policy "read saves" on public.saves for select using (true);
create policy "write saves" on public.saves for insert with check (true);
create policy "remove saves" on public.saves for delete using (true);

create policy "read remixes" on public.remixes for select using (true);
create policy "write remixes" on public.remixes for insert with check (true);
create policy "remove remixes" on public.remixes for delete using (true);
