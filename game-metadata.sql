begin;
create table public.playfeed_game_metadata (
  game_url text primary key,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  author text not null check (char_length(btrim(author)) between 1 and 120),
  updated_at timestamptz not null default now(),
  updated_by text not null
);
alter table public.playfeed_game_metadata enable row level security;
revoke all on public.playfeed_game_metadata from public, anon, authenticated;
grant select (game_url,title,author,updated_at) on public.playfeed_game_metadata to anon, authenticated;
grant select,insert,update,delete on public.playfeed_game_metadata to service_role;
create policy "Public game display metadata" on public.playfeed_game_metadata for select to anon, authenticated using (true);

create function public.playfeed_edit_game_metadata(p_game_url text, p_title text, p_author text, p_updated_by text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.playfeed_game_metadata;
begin
  insert into public.playfeed_game_metadata(game_url,title,author,updated_by)
  values(p_game_url,btrim(p_title),btrim(p_author),p_updated_by)
  on conflict(game_url) do update set title=excluded.title,author=excluded.author,updated_by=excluded.updated_by,updated_at=clock_timestamp()
  returning * into saved;
  update public.playfeed_recommendations set title=saved.title,author=saved.author where url=p_game_url;
  update public.playfeed_notifications set title=saved.title where game_id in (select id from public.playfeed_recommendations where url=p_game_url);
  update public.playfeed_game_reports set game_title=saved.title where game_url=p_game_url;
  return jsonb_build_object('game_url',saved.game_url,'title',saved.title,'author',saved.author,'updated_at',saved.updated_at);
end;
$$;
revoke all on function public.playfeed_edit_game_metadata(text,text,text,text) from public,anon,authenticated;
grant execute on function public.playfeed_edit_game_metadata(text,text,text,text) to service_role;
commit;
