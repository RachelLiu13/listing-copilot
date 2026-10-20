-- Compliance suite: more marketplaces, audits, risk scores, rule versions,
-- an evidence library and appeals. Safe to run more than once.

-- Listings: more marketplaces, audit mode, risk score, rules version.
alter table public.listings drop constraint if exists listings_platform_check;
alter table public.listings add constraint listings_platform_check
  check (platform in ('amazon_us', 'tiktok_us', 'amazon_uk', 'amazon_de', 'amazon_jp'));
alter table public.listings add column if not exists mode text not null default 'generate';
alter table public.listings drop constraint if exists listings_mode_check;
alter table public.listings add constraint listings_mode_check check (mode in ('generate', 'audit'));
alter table public.listings add column if not exists risk_score integer;
alter table public.listings add column if not exists rules_version integer;

-- Event log: new kinds of model work.
alter table public.generation_events drop constraint if exists generation_events_kind_check;
alter table public.generation_events add constraint generation_events_kind_check
  check (kind in ('generate', 'rewrite', 'audit', 'appeal', 'explain'));

-- Evidence library: documents that let a claim stay in a listing.
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('test_report', 'certificate', 'registration', 'other')),
  reference text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists evidence_user on public.evidence (user_id, created_at desc);
alter table public.evidence enable row level security;
drop policy if exists "own evidence" on public.evidence;
create policy "own evidence" on public.evidence for select using (auth.uid() = user_id);

-- Appeal assistant results.
create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  notice text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists appeals_user on public.appeals (user_id, created_at desc);
alter table public.appeals enable row level security;
drop policy if exists "own appeals" on public.appeals;
create policy "own appeals" on public.appeals for select using (auth.uid() = user_id);
