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

alter table public.elbureau_rooms
    add column if not exists current_question_index integer not null default 0;

alter table public.elbureau_rooms
    add column if not exists phase_started_at timestamptz not null default now();

alter table public.elbureau_rooms
    add column if not exists final_mode text not null default 'shared';

create table if not exists public.elbureau_bets (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    question_index integer not null,
    player_id text not null,
    bet_value integer not null,
    created_at timestamptz not null default now(),
    primary key (room_code, question_index, player_id),
    unique (room_code, player_id, bet_value)
);

create table if not exists public.elbureau_answers (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    question_index integer not null,
    player_id text not null,
    answer text not null,
    submitted_at timestamptz not null default now(),
    primary key (room_code, question_index, player_id)
);

create table if not exists public.elbureau_validations (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    question_index integer not null,
    player_id text not null,
    is_correct boolean not null,
    validated_by text,
    validated_at timestamptz not null default now(),
    primary key (room_code, question_index, player_id)
);

create table if not exists public.elbureau_final_choices (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    player_id text not null,
    wager integer not null,
    difficulty text not null,
    mode text not null,
    updated_at timestamptz not null default now(),
    primary key (room_code, player_id)
);

create table if not exists public.elbureau_final_questions (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    player_id text not null,
    question jsonb not null,
    created_at timestamptz not null default now(),
    primary key (room_code, player_id)
);

create table if not exists public.elbureau_final_answers (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    player_id text not null,
    answer text not null,
    submitted_at timestamptz not null default now(),
    primary key (room_code, player_id)
);

create table if not exists public.elbureau_final_validations (
    room_code text not null references public.elbureau_rooms(room_code) on delete cascade,
    player_id text not null,
    is_correct boolean not null,
    validated_by text,
    validated_at timestamptz not null default now(),
    primary key (room_code, player_id)
);

alter table public.elbureau_bets replica identity full;
alter table public.elbureau_answers replica identity full;
alter table public.elbureau_validations replica identity full;
alter table public.elbureau_final_choices replica identity full;
alter table public.elbureau_final_questions replica identity full;
alter table public.elbureau_final_answers replica identity full;
alter table public.elbureau_final_validations replica identity full;

alter table public.elbureau_bets disable row level security;
alter table public.elbureau_answers disable row level security;
alter table public.elbureau_validations disable row level security;
alter table public.elbureau_final_choices disable row level security;
alter table public.elbureau_final_questions disable row level security;
alter table public.elbureau_final_answers disable row level security;
alter table public.elbureau_final_validations disable row level security;

-- Keep using the existing public.set_updated_at() function created in the initial migration.

drop trigger if exists set_updated_at_elbureau_final_choices on public.elbureau_final_choices;
create trigger set_updated_at_elbureau_final_choices
before update on public.elbureau_final_choices
for each row
execute function public.set_updated_at();

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            alter publication supabase_realtime add table public.elbureau_bets;
        exception when duplicate_object then null; end;

        begin
            alter publication supabase_realtime add table public.elbureau_answers;
        exception when duplicate_object then null; end;

        begin
            alter publication supabase_realtime add table public.elbureau_validations;
        exception when duplicate_object then null; end;

        begin
            alter publication supabase_realtime add table public.elbureau_final_choices;
        exception when duplicate_object then null; end;

        begin
            alter publication supabase_realtime add table public.elbureau_final_questions;
        exception when duplicate_object then null; end;

        begin
            alter publication supabase_realtime add table public.elbureau_final_answers;
        exception when duplicate_object then null; end;

        begin
            alter publication supabase_realtime add table public.elbureau_final_validations;
        exception when duplicate_object then null; end;
    end if;
end;
$$;
