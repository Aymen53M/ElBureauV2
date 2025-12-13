create table if not exists public.elbureau_rooms (
    room_code text primary key,
    host_player_id text not null,
    settings jsonb not null,
    phase text not null default 'lobby',
    questions jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.elbureau_rooms
    add column if not exists questions jsonb not null default '[]'::jsonb;

create table if not exists public.elbureau_room_players (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    player_id text not null,
    name text not null,
    score integer not null default 0,
    is_host boolean not null default false,
    is_ready boolean not null default false,
    has_api_key boolean not null default false,
    used_bets integer[] not null default '{}'::integer[],
    avatar text,
    joined_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (room_code, player_id)
);

create index if not exists elbureau_room_players_room_code_idx on public.elbureau_room_players(room_code);

alter table public.elbureau_rooms replica identity full;
alter table public.elbureau_room_players replica identity full;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_updated_at_elbureau_rooms on public.elbureau_rooms;
create trigger set_updated_at_elbureau_rooms
before update on public.elbureau_rooms
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_elbureau_room_players on public.elbureau_room_players;
create trigger set_updated_at_elbureau_room_players
before update on public.elbureau_room_players
for each row
execute function public.set_updated_at();

alter table public.elbureau_rooms disable row level security;
alter table public.elbureau_room_players disable row level security;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            alter publication supabase_realtime add table public.elbureau_rooms;
        exception
            when duplicate_object then null;
        end;

        begin
            alter publication supabase_realtime add table public.elbureau_room_players;
        exception
            when duplicate_object then null;
        end;
    end if;
end;
$$;
