alter table public.playfeed_analytics_events add column entry_source text not null default 'unknown', add column previous_game_id text not null default '';
create or replace function public.playfeed_analytics_report(p_days integer default 7,p_audience text default 'external')
returns jsonb language sql stable security invoker set search_path=public as $$
with selected as (
 select e.*,d.family,d.browser,d.is_owner,d.label
 from playfeed_analytics_events e join playfeed_analytics_devices d on d.id=e.device_id
 where e.created_at>=now()-make_interval(days=>least(90,greatest(1,p_days)))
 and not e.is_bot
 and (p_audience='all' or (p_audience='owner' and d.is_owner) or (p_audience='external' and not d.is_owner))
), game_stats as (
 select game_id,max(game_title) as title,count(*) filter(where action='game_view') as views,
 count(distinct device_id) as visitors,count(distinct session_id) as sessions,
 sum(duration_ms) as duration_ms,
 count(*) filter(where action='save_click') as save_clicks,
 count(*) filter(where action='save_success') as saves,
 count(*) filter(where action='unsave_success') as unsaves,
 count(*) filter(where action='comments_open') as comments_open,
 count(*) filter(where action='comment_success') as comments,
 count(*) filter(where action='share_click') as share_clicks,
 count(*) filter(where action='share_success') as shares,
 count(*) filter(where action='report_success') as reports,
 count(*) filter(where action='creator_open') as creator_opens
 from selected where game_id<>'' group by game_id
), entries as (
 select game_id,max(game_title) as title,entry_source,count(*) filter(where action='game_view') as views,
 count(distinct device_id) as visitors,sum(duration_ms) as duration_ms
 from selected where game_id<>'' and action in ('game_view','game_time') group by game_id,entry_source
), actions as (
 select action,count(*) as count from selected where action<>'game_time' group by action
), devices as (
 select family,browser,count(distinct device_id) as visitors,count(*) filter(where action='page_view') as page_views
 from selected group by family,browser
), sources as (
 select coalesce(nullif(referrer,''),'直接開啟／未知') as source,count(*) as visits
 from selected where action='page_view' group by referrer
), days as (
 select (created_at at time zone 'Asia/Taipei')::date as date,count(distinct device_id) as visitors,
 count(*) filter(where action='game_view') as views,sum(duration_ms) as duration_ms
 from selected group by 1
)
select jsonb_build_object(
 'summary',(select jsonb_build_object('visitors',count(distinct device_id),'sessions',count(distinct session_id),'page_views',count(*) filter(where action='page_view'),'game_views',count(*) filter(where action='game_view'),'duration_ms',coalesce(sum(duration_ms),0)) from selected),
 'games',coalesce((select jsonb_agg(to_jsonb(g) order by views desc,duration_ms desc) from game_stats g),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(to_jsonb(e) order by game_id,views desc) from entries e),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(to_jsonb(a) order by count desc) from actions a),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(to_jsonb(d)) from devices d),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(to_jsonb(s) order by visits desc) from sources s),'[]'::jsonb),
 'days',coalesce((select jsonb_agg(to_jsonb(d) order by date) from days d),'[]'::jsonb),
 'started_at',(select min(created_at) from playfeed_analytics_events)
);
$$;
revoke all on function public.playfeed_analytics_report(integer,text) from public,anon,authenticated;
grant execute on function public.playfeed_analytics_report(integer,text) to service_role;
