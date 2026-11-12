
create table public.playfeed_admins (email text primary key);
alter table public.playfeed_admins enable row level security;
revoke all on public.playfeed_admins from anon, authenticated;
grant all on public.playfeed_admins to service_role;
insert into public.playfeed_admins(email) values ('paulvongulla@gmail.com') on conflict do nothing;
create table public.playfeed_profiles (
 user_id text primary key, display_name text not null check(char_length(display_name) between 1 and 40),
 bio text not null default '' check(char_length(bio)<=300), website text not null default '' check(char_length(website)<=500),
 updated_at timestamptz not null default now()
);
create table public.playfeed_requests (
 id uuid primary key default gen_random_uuid(), user_id text not null, url text not null check(url ~ '^https://' and char_length(url)<=1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 published_game_id uuid references public.playfeed_recommendations(id), created_at timestamptz not null default now(),
 reviewed_at timestamptz, unique(user_id,url)
);
create index on public.playfeed_requests(status,created_at);
create table public.playfeed_notifications (
 id uuid primary key default gen_random_uuid(), user_id text not null, request_id uuid not null unique references public.playfeed_requests(id),
 game_id uuid not null references public.playfeed_recommendations(id), title text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create index on public.playfeed_notifications(user_id,created_at);
alter table public.playfeed_profiles enable row level security;
alter table public.playfeed_requests enable row level security;
alter table public.playfeed_notifications enable row level security;
revoke all on public.playfeed_profiles,public.playfeed_requests,public.playfeed_notifications from anon,authenticated;
grant all on public.playfeed_profiles,public.playfeed_requests,public.playfeed_notifications to service_role;
drop policy if exists comments_insert on public.playfeed_game_comments;
create function public.playfeed_match_recommendations() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 with approved as (
 update public.playfeed_requests set status='approved',published_game_id=new.id,reviewed_at=now()
 where url=new.url and status='pending' returning id,user_id
 )
 insert into public.playfeed_notifications(user_id,request_id,game_id,title)
 select user_id,id,new.id,new.title from approved on conflict(request_id) do nothing;
 return new;
end;
$$;
revoke all on function public.playfeed_match_recommendations() from public,anon,authenticated;
create trigger playfeed_recommendation_published after insert or update of url,title on public.playfeed_recommendations for each row execute function public.playfeed_match_recommendations();
