create or replace function public.playfeed_expansion_report(p_days integer default 7, p_audience text default 'external')
returns jsonb language sql stable security invoker set search_path=public as $$
with selected as (
 select e.game_id,e.game_title,e.action
 from public.playfeed_analytics_events e
 join public.playfeed_analytics_devices d on d.id=e.device_id
 where e.created_at>=now()-make_interval(days=>least(90,greatest(1,p_days)))
 and not e.is_bot
 and e.action in ('game_expand','expanded_previous_game','expanded_next_game')
 and (p_audience='all' or (p_audience='owner' and d.is_owner) or (p_audience='external' and not d.is_owner))
), games as (
 select game_id,max(game_title) as title,
 count(*) filter(where action='game_expand') as expands,
 count(*) filter(where action='expanded_previous_game') as previous,
 count(*) filter(where action='expanded_next_game') as next
 from selected where game_id<>'' group by game_id
)
select jsonb_build_object(
 'summary',(select jsonb_build_object(
  'expands',count(*) filter(where action='game_expand'),
  'previous',count(*) filter(where action='expanded_previous_game'),
  'next',count(*) filter(where action='expanded_next_game')) from selected),
 'games',coalesce((select jsonb_agg(to_jsonb(g) order by expands desc,title) from games g),'[]'::jsonb)
);
$$;
revoke all on function public.playfeed_expansion_report(integer,text) from public,anon,authenticated;
grant execute on function public.playfeed_expansion_report(integer,text) to service_role;
