-- Visitor saves are private to the server. Browsers keep their own collection locally.
create table public.playfeed_guest_saves (
 device_id uuid not null references public.playfeed_analytics_devices(id),
 game_key text not null check(length(game_key) between 3 and 500),
 countable boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(device_id,game_key)
);
create index playfeed_guest_saves_game_idx on public.playfeed_guest_saves(game_key);
alter table public.playfeed_guest_saves enable row level security;
revoke all on public.playfeed_guest_saves from anon,authenticated;
grant all on public.playfeed_guest_saves to service_role;
create index playfeed_public_share_count_idx on public.playfeed_analytics_events(game_id,device_id) where action='share_success' and not is_bot;

create or replace function public.playfeed_guest_save_batch(p_device_id uuid,p_changes jsonb,p_countable boolean)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb;
begin
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>32 then raise exception 'Invalid save batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_device_id::text,0));
 for item in select value from jsonb_array_elements(p_changes) loop
  if item->>'active'='true' then
   insert into playfeed_guest_saves(device_id,game_key,countable) values(p_device_id,item->>'gameKey',p_countable)
   on conflict(device_id,game_key) do update set countable=excluded.countable;
  else delete from playfeed_guest_saves where device_id=p_device_id and game_key=item->>'gameKey'; end if;
 end loop;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.playfeed_merge_guest_saves(p_device_id uuid,p_user_id text,p_games text[])
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if length(p_user_id)=0 or cardinality(p_games)>500 then raise exception 'Invalid merge'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_device_id::text,0));
 insert into playfeed_user_actions(user_id,game_key,kind)
 select p_user_id,key,'save' from unnest(p_games) as key on conflict(user_id,game_key,kind) do nothing;
 delete from playfeed_guest_saves where device_id=p_device_id;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.playfeed_engagement_counts(p_game_key text,p_game_id text default '',p_device_id uuid default null)
returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'saveCount',(select count(*) from playfeed_user_actions where game_key=p_game_key and kind='save')+
 (select count(*) from playfeed_guest_saves s join playfeed_analytics_devices d on d.id=s.device_id where s.game_key=p_game_key and s.countable and not d.is_owner),
 'commentCount',(select count(*) from playfeed_game_comments where game_key=p_game_key),
 'shareCount',(select count(*) from playfeed_analytics_events e join playfeed_analytics_devices d on d.id=e.device_id where e.game_id=p_game_id and e.action='share_success' and not e.is_bot and not d.is_owner),
 'guestSaved',exists(select 1 from playfeed_guest_saves where game_key=p_game_key and device_id=p_device_id)
);
$$;
revoke all on function public.playfeed_guest_save_batch(uuid,jsonb,boolean),public.playfeed_merge_guest_saves(uuid,text,text[]),public.playfeed_engagement_counts(text,text,uuid) from public,anon,authenticated;
grant execute on function public.playfeed_guest_save_batch(uuid,jsonb,boolean),public.playfeed_merge_guest_saves(uuid,text,text[]),public.playfeed_engagement_counts(text,text,uuid) to service_role;
