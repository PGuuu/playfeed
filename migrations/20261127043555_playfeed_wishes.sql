create table public.playfeed_wishes (
  id bigint generated always as identity primary key,
  display_name text not null check (char_length(display_name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 1000 and body ~ '[^[:space:]]'),
  is_member boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.playfeed_wishes enable row level security;
revoke all on public.playfeed_wishes from public, anon, authenticated;
grant select, insert on public.playfeed_wishes to service_role;
