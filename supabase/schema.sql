-- Supabase schema for the 1% Quiz MVP.
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  admin_pin text not null,
  jackpot integer not null default 100,
  current_question_index integer not null default 0,
  status text not null default 'lobby' check (status in ('lobby', 'running', 'revealing', 'finished')),
  created_at timestamptz default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'out')),
  joined_at timestamptz default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  question_order integer not null,
  difficulty text not null,
  type text not null check (type in ('mc', 'text')),
  question text not null,
  options jsonb,
  correct_answer text not null,
  unique (room_id, question_order)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  answer text not null,
  is_correct boolean,
  submitted_at timestamptz default now(),
  unique (player_id, question_id)
);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.answers;

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

create policy "Public read rooms" on public.rooms for select using (true);
create policy "Public create rooms" on public.rooms for insert with check (true);
create policy "Public update rooms MVP" on public.rooms for update using (true) with check (true);

create policy "Public read players" on public.players for select using (true);
create policy "Public create players" on public.players for insert with check (true);
create policy "Public update players MVP" on public.players for update using (true) with check (true);

create policy "Public read questions" on public.questions for select using (true);
create policy "Public create questions MVP" on public.questions for insert with check (true);

create policy "Public read answers" on public.answers for select using (true);
create policy "Public create answers" on public.answers for insert with check (true);
