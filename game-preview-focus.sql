alter table public.playfeed_game_previews
 add column share_image_url text check(share_image_url ~ '^(/api/game-image\?key=[a-f0-9]{64}|/share-cards/screenshots/[a-zA-Z0-9._-]+\.png)$'),
 add column focus_x double precision not null default 0.5 check(focus_x between 0 and 1),
 add column focus_y double precision not null default 0.5 check(focus_y between 0 and 1),
 add column focus_zoom double precision not null default 1 check(focus_zoom between 1 and 3);
