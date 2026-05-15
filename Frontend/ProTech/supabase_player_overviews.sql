create table if not exists public.player_overviews (
  athlete_id uuid primary key references public.names(id) on delete cascade,
  overview text not null,
  context_hash text not null,
  model text,
  generated_at timestamptz not null default now()
);

create index if not exists player_overviews_generated_at_idx
  on public.player_overviews (generated_at desc);

alter table public.player_overviews enable row level security;

-- Logged-in coaches can read cached overviews in the app
drop policy if exists "Authenticated users can read overviews" on public.player_overviews;
create policy "Authenticated users can read overviews"
  on public.player_overviews for select
  to authenticated
  using (true);

-- Lets logged-in coaches write/update cache from the app (optional; backend uses service_role too)
drop policy if exists "Authenticated users can insert overviews" on public.player_overviews;
create policy "Authenticated users can insert overviews"
  on public.player_overviews for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update overviews" on public.player_overviews;
create policy "Authenticated users can update overviews"
  on public.player_overviews for update
  to authenticated
  using (true);
