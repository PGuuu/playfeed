create table public.playfeed_game_ratings (
 id uuid primary key default gen_random_uuid(),
 game_key text not null check(length(game_key) between 3 and 500),
 reviewer_key text not null,
 user_id text,
 device_id uuid not null references public.playfeed_analytics_devices(id),
 stars smallint not null check(stars between 1 and 3),
 body text not null check(length(btrim(body)) between 1 and 1000),
 display_name text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(game_key,reviewer_key)
);
create index playfeed_ratings_game_updated on public.playfeed_game_ratings(game_key,updated_at desc,id);
create index playfeed_ratings_device on public.playfeed_game_ratings(device_id);
alter table public.playfeed_game_ratings enable row level security;
revoke all on public.playfeed_game_ratings from public,anon,authenticated;
grant all on public.playfeed_game_ratings to service_role;
create or replace function public.playfeed_rate_game(p_game_key text,p_device_id uuid,p_user_id text,p_name text,p_stars integer,p_body text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare who text;
begin
 if p_stars is null or p_stars not between 1 and 3 or length(btrim(p_body)) not between 1 and 1000 then raise exception 'Invalid rating'; end if;
 who:=case when p_user_id is null then 'device:'||p_device_id else 'user:'||p_user_id end;
 perform pg_advisory_xact_lock(hashtextextended(p_game_key||':'||who,0));
 if p_user_id is not null then delete from playfeed_game_ratings where game_key=p_game_key and reviewer_key='device:'||p_device_id; end if;
 insert into playfeed_game_ratings(game_key,reviewer_key,user_id,device_id,stars,body,display_name)
 values(p_game_key,who,p_user_id,p_device_id,p_stars,btrim(p_body),left(p_name,100))
 on conflict(game_key,reviewer_key) do update set stars=excluded.stars,body=excluded.body,display_name=excluded.display_name,device_id=excluded.device_id,updated_at=now();
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.playfeed_game_rating_summary(p_game_key text,p_device_id uuid default null,p_user_id text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'distribution',coalesce((select jsonb_object_agg(stars,total) from (select stars,count(*) total from playfeed_game_ratings where game_key=p_game_key group by stars) tally),'{}'::jsonb),
 'ratingCount',(select count(*) from playfeed_game_ratings where game_key=p_game_key),
 'ownRating',(select jsonb_build_object('stars',stars,'body',body) from playfeed_game_ratings where game_key=p_game_key and (reviewer_key='device:'||p_device_id or (p_user_id is not null and reviewer_key='user:'||p_user_id)) order by case when reviewer_key='user:'||p_user_id then 0 else 1 end limit 1),
 'reviews',coalesce((select jsonb_agg(to_jsonb(reviews) order by updated_at desc,id) from (select id,stars,body,display_name,created_at,updated_at from playfeed_game_ratings where game_key=p_game_key order by updated_at desc,id limit 100) reviews),'[]'::jsonb),
 'legacyComments',coalesce((select jsonb_agg(to_jsonb(legacy) order by created_at desc,id) from (select id,body,display_name,created_at from playfeed_game_comments where game_key=p_game_key order by created_at desc,id limit 50) legacy),'[]'::jsonb)
);
$$;
revoke all on function public.playfeed_rate_game(text,uuid,text,text,integer,text),public.playfeed_game_rating_summary(text,uuid,text) from public,anon,authenticated;
grant execute on function public.playfeed_rate_game(text,uuid,text,text,integer,text),public.playfeed_game_rating_summary(text,uuid,text) to service_role;
