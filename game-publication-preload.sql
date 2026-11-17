alter table public.playfeed_recommendations add column preload_image_url text
check(preload_image_url ~ '^/api/game-image\?key=[a-f0-9]{64}$');
