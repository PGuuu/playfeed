-- PlayFeed secure writes
-- Public visitors may read published content. All writes must go through
-- /api/write, which verifies a Phuze session and uses the Supabase service role.

begin;

alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.scores enable row level security;
alter table public.saves enable row level security;
alter table public.remixes enable row level security;
alter table public.user_games enable row level security;
alter table public.user_game_scores enable row level security;

drop policy if exists "write likes" on public.likes;
drop policy if exists "remove likes" on public.likes;
drop policy if exists "write comments" on public.comments;
drop policy if exists "write scores" on public.scores;
drop policy if exists "update scores" on public.scores;
drop policy if exists "write saves" on public.saves;
drop policy if exists "remove saves" on public.saves;
drop policy if exists "write remixes" on public.remixes;
drop policy if exists "remove remixes" on public.remixes;
drop policy if exists "write user games" on public.user_games;
drop policy if exists "update user games" on public.user_games;
drop policy if exists "write user game scores" on public.user_game_scores;
drop policy if exists "update user game scores" on public.user_game_scores;

-- Defense in depth: even if a permissive policy is accidentally added later,
-- the browser roles still have no table-level write privilege.
revoke insert, update, delete, truncate, references, trigger
  on public.likes, public.comments, public.scores, public.saves,
     public.remixes, public.user_games, public.user_game_scores
  from anon, authenticated;

commit;
