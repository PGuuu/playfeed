create or replace function public.playfeed_engagement_counts(p_game_key text,p_game_id text default '',p_device_id uuid default null)
returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'saveCount',(select count(*) from playfeed_user_actions where game_key=p_game_key and kind='save')+
 (select count(*) from playfeed_guest_saves s where s.game_key=p_game_key and s.countable),
 'commentCount',(select count(*) from playfeed_game_comments where game_key=p_game_key),
 'shareCount',(select count(*) from playfeed_analytics_events e join playfeed_analytics_devices d on d.id=e.device_id where e.game_id=p_game_id and e.action='share_success' and not e.is_bot),
 'guestSaved',exists(select 1 from playfeed_guest_saves where game_key=p_game_key and device_id=p_device_id)
);
$$;
