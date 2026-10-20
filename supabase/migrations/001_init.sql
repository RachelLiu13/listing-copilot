-- Listing Copilot schema. Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Security model:
--   * Row Level Security on every table: a signed-in user can read only their own rows.
--   * Users can never write credits, plan or payments directly. Those change only
--     through the functions below, which are callable by the service role (the
--     server) and not by browser sessions.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  credits integer not null default 3 check (credits >= 0),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  pro_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('amazon_us', 'tiktok_us')),
  product_name text not null,
  input jsonb not null,          -- seller input, without the photo
  result jsonb,                  -- ListingResult: facts, keywords, copy, compliance, usage
  status text not null default 'complete' check (status in ('complete', 'failed')),
  rewrites integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_user_created on public.listings (user_id, created_at desc);

-- Every generation attempt (also ones that ask for more info or fail): rate limiting and cost tracking.
create table if not exists public.generation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('generate', 'rewrite')),
  outcome text not null check (outcome in ('started', 'needs_info', 'complete', 'failed', 'no_credits')),
  detail text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists generation_events_user_created on public.generation_events (user_id, created_at desc);

-- One row per Stripe event: makes webhook handling idempotent (Stripe retries deliveries).
create table if not exists public.payments (
  stripe_event_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  stripe_session_id text,
  amount_total integer,
  currency text,
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.generation_events enable row level security;
alter table public.payments enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own listings" on public.listings;
create policy "own listings" on public.listings for select using (auth.uid() = user_id);
drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments for select using (auth.uid() = user_id);
-- generation_events: no select policy; only the server reads it.

-- New user -> profile with the free credits.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Spend one credit atomically. Pro (active) users are not charged.
-- Returns 'pro', 'charged' or 'no_credits'.
create or replace function public.consume_credit(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_plan text; v_until timestamptz; v_left integer;
begin
  select plan, pro_until into v_plan, v_until from profiles where id = p_user for update;
  if v_plan = 'pro' and (v_until is null or v_until > now()) then return 'pro'; end if;
  update profiles set credits = credits - 1 where id = p_user and credits > 0 returning credits into v_left;
  if not found then return 'no_credits'; end if;
  return 'charged';
end $$;

-- Give a credit back when generation fails after charging.
create or replace function public.refund_credit(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update profiles set credits = credits + 1 where id = p_user;
$$;

-- Record a Stripe event once and apply it. Returns false if the event was already applied.
create or replace function public.apply_payment(
  p_event_id text, p_user uuid, p_kind text, p_session_id text, p_amount integer, p_currency text,
  p_add_credits integer, p_set_plan text, p_pro_until timestamptz, p_customer_id text, p_subscription_id text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into payments (stripe_event_id, user_id, kind, stripe_session_id, amount_total, currency, status)
  values (p_event_id, p_user, p_kind, p_session_id, p_amount, p_currency, 'applied')
  on conflict (stripe_event_id) do nothing;
  if not found then return false; end if;
  update profiles set
    credits = credits + coalesce(p_add_credits, 0),
    plan = coalesce(p_set_plan, plan),
    pro_until = case when p_set_plan is null then pro_until else p_pro_until end,
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id)
  where id = p_user;
  return true;
end $$;

-- Only the server (service role) may call the money functions.
revoke execute on function public.consume_credit(uuid) from public, anon, authenticated;
revoke execute on function public.refund_credit(uuid) from public, anon, authenticated;
revoke execute on function public.apply_payment(text, uuid, text, text, integer, text, integer, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid) to service_role;
grant execute on function public.refund_credit(uuid) to service_role;
grant execute on function public.apply_payment(text, uuid, text, text, integer, text, integer, text, timestamptz, text, text) to service_role;
