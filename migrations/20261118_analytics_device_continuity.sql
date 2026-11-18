create table public.playfeed_analytics_device_aliases (
 device_id uuid primary key references public.playfeed_analytics_devices(id),
 canonical_id uuid not null references public.playfeed_analytics_devices(id),
 check (device_id <> canonical_id)
);
alter table public.playfeed_analytics_device_aliases enable row level security;
revoke all on public.playfeed_analytics_device_aliases from anon, authenticated;
grant select on public.playfeed_analytics_device_aliases to service_role;

-- Link only IDs confined to one visit and compatible with its browser and audience.
with observations as (
 select e.device_id,e.session_id,min(e.created_at) first_event,count(*) events,
 d.family,d.browser,d.is_owner
 from public.playfeed_analytics_events e join public.playfeed_analytics_devices d on d.id=e.device_id
 where not e.is_bot group by 1,2,5,6,7
), ranked as (
 select *,count(*) over(partition by device_id) session_count
 from observations
), candidates as (
 select *,first_value(device_id) over(partition by session_id,family,browser,is_owner
 order by session_count desc, first_event asc, events desc, device_id) canonical_id
 from ranked
)
insert into public.playfeed_analytics_device_aliases (device_id, canonical_id)
select device_id, canonical_id from candidates
where session_count=1 and device_id<>canonical_id;

CREATE OR REPLACE FUNCTION public.playfeed_analytics_report(p_days integer DEFAULT 7, p_audience text DEFAULT 'external'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with selected as (
 select e.*,coalesce(a.canonical_id,e.device_id) as canonical_device_id,d.family,d.browser,d.is_owner,d.label
 from playfeed_analytics_events e join playfeed_analytics_devices d on d.id=e.device_id
 left join playfeed_analytics_device_aliases a on a.device_id=e.device_id
 where e.created_at>=now()-make_interval(days=>least(90,greatest(1,p_days)))
 and not e.is_bot
 and (p_audience='all' or (p_audience='owner' and d.is_owner) or (p_audience='external' and not d.is_owner))
), game_stats as (
 select game_id,max(game_title) as title,count(*) filter(where action='game_view') as views,
 count(distinct canonical_device_id) as visitors,count(distinct session_id) as sessions,
 sum(duration_ms) as duration_ms,
 count(*) filter(where action='save_click') as save_clicks,
 count(*) filter(where action in ('save_success','guest_save_success')) as saves,
 count(*) filter(where action='guest_save_success') as guest_saves,
 count(*) filter(where action='save_success') as member_saves,
 count(*) filter(where action='save_sync_success') as save_syncs,
 count(*) filter(where action in ('unsave_success','guest_unsave_success')) as unsaves,
 count(*) filter(where action in ('comments_open','rating_open')) as comments_open,
 count(*) filter(where action in ('comment_success','rating_success')) as comments,
 count(*) filter(where action='share_click') as share_clicks,
 count(*) filter(where action='share_success') as shares,
 count(*) filter(where action='report_success') as reports,
 count(*) filter(where action='creator_open') as creator_opens
 from selected where game_id<>'' group by game_id
), entries as (
 select game_id,max(game_title) as title,entry_source,count(*) filter(where action='game_view') as views,
 count(distinct canonical_device_id) as visitors,sum(duration_ms) as duration_ms
 from selected where game_id<>'' and action in ('game_view','game_time') group by game_id,entry_source
), actions as (
 select action,count(*) as count from selected where action<>'game_time' group by action
), devices as (
 select family,browser,count(distinct canonical_device_id) as visitors,count(*) filter(where action='page_view') as page_views
 from selected group by family,browser
), sources as (
 select coalesce(nullif(referrer,''),'�����}�ҡ�����') as source,count(*) as visits
 from selected where action='page_view' group by referrer
), days as (
 select (created_at at time zone 'Asia/Taipei')::date as date,count(distinct canonical_device_id) as visitors,
 count(*) filter(where action='game_view') as views,sum(duration_ms) as duration_ms
 from selected group by 1
)
select jsonb_build_object(
 'summary',(select jsonb_build_object('visitors',count(distinct canonical_device_id),'sessions',count(distinct session_id),'page_views',count(*) filter(where action='page_view'),'game_views',count(*) filter(where action='game_view'),'duration_ms',coalesce(sum(duration_ms),0)) from selected),
 'games',coalesce((select jsonb_agg(to_jsonb(g) order by views desc,duration_ms desc) from game_stats g),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(to_jsonb(e) order by game_id,views desc) from entries e),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(to_jsonb(a) order by count desc) from actions a),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(to_jsonb(d)) from devices d),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(to_jsonb(s) order by visits desc) from sources s),'[]'::jsonb),
 'days',coalesce((select jsonb_agg(to_jsonb(d) order by date) from days d),'[]'::jsonb),
 'started_at',(select min(created_at) from playfeed_analytics_events)
);
$function$;
