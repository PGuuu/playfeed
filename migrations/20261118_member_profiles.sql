alter table public.playfeed_profiles
  add column public_id uuid unique,
  add column avatar text check (char_length(avatar) <= 140000);

create table public.playfeed_follows (
  follower_id text not null,
  target_id uuid not null references public.playfeed_profiles(public_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, target_id)
);
alter table public.playfeed_follows enable row level security;
revoke all on public.playfeed_follows from anon, authenticated;
grant all on public.playfeed_follows to service_role;
