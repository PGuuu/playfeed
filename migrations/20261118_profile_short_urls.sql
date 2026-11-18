alter table public.playfeed_profiles
  add column public_slug text unique
  check (public_slug is null or (public_slug ~ '^[a-z]{2,12}-[a-z]{2,12}$' and public_id is not null));
