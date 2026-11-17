create table public.playfeed_game_previews (
 game_url text primary key,
 image_url text not null check (image_url ~ '^(/api/game-image\?key=[a-f0-9]{64}|/share-cards/screenshots/[a-zA-Z0-9._-]+\.png)$'),
 width integer not null check(width between 100 and 1280),
 height integer not null check(height between 100 and 1280),
 updated_by text not null,
 updated_at timestamptz not null default now()
);
alter table public.playfeed_game_previews enable row level security;
grant select on public.playfeed_game_previews to anon,authenticated;
grant all on public.playfeed_game_previews to service_role;
create policy "Public preview images" on public.playfeed_game_previews for select to anon,authenticated using(true);
