-- Client plans: the plan a client bought by contract (Starter, Growth or Pro), assigned to the
-- client's account by an admin in the admin panel (/dashboard/admin, tab "Plans").
--
-- ADDITIVE and SAFE TO RUN TWICE: one new table with its indexes, one RLS policy and one
-- trigger function of its own. Nothing that exists is changed or dropped. The app works before
-- and after this file is applied: until then the server finds no table, the admin panel says
-- plans are not set up yet, and clients see no plan.
--
-- What a plan unlocks (src/lib/client-plans.ts):
--   - the client's dashboard shows the plan and the hours it includes each month
--     (Starter 1 h, Growth 4 h, Pro 10 h);
--   - while DEEP_RESEARCH_MODE=premium, deep research reports per calendar period in Romanian
--     time: Starter 1 a quarter, Growth 2 a month, Pro 5 a month, counted from the account's
--     deep_runs started through the plan (failed and canceled runs do not count). Admins keep
--     their own caps. DEEP_RESEARCH_PREMIUM_TIERS lists the plans that include reports
--     (default: starter,growth,pro).
--
-- Rows are a history. At most one row per account is 'active' (partial unique index). Choosing
-- another plan ends the active row (status 'ended', ended_at, ended_by) and adds a new one, so
-- the record shows which plan ran when and under which contract. starts_on and ends_on are
-- calendar days in Romania, both included; no ends_on means until an admin ends it.
--
-- Access: RLS on. A signed-in client reads only their own rows (policy below); nobody writes
-- except the server with the service role (no insert, update or delete grant or policy for
-- anon or authenticated). Deleting an account deletes its plan rows (on delete cascade).
--
-- BEFORE APPLYING (owner, Lovable Cloud SQL editor, read only): the table must not exist yet,
-- or exist from an earlier run of this same file:
--   select to_regclass('public.client_plans');   -- null (not applied yet) or client_plans
--
-- HOW TO APPLY (owner): in Lovable, ask:
--   "Apply drizzle/pending/client_plans.sql exactly as written. It only adds the table
--    public.client_plans with its indexes, one select policy and its updated_at trigger.
--    Do not change it, do not rename anything and do not add any grant or policy. Then
--    regenerate the Supabase types."
-- Lovable saves its own numbered copy in drizzle/migrations/; once it is there, this pending
-- file is deleted (drizzle/README.md). Nobody runs this SQL by hand.
-- Check afterwards (SQL editor), each must answer as noted:
--   select relrowsecurity from pg_class where oid = 'public.client_plans'::regclass;       -- true
--   select has_table_privilege('anon', 'public.client_plans', 'select');                   -- false
--   select has_table_privilege('authenticated', 'public.client_plans', 'select');          -- true
--   select has_table_privilege('authenticated', 'public.client_plans', 'insert');          -- false
--   select has_table_privilege('authenticated', 'public.client_plans', 'update');          -- false
--   select count(*) from pg_policies where schemaname = 'public' and tablename = 'client_plans';  -- 1
--   select count(*) from pg_indexes where schemaname = 'public' and tablename = 'client_plans';   -- 3
-- Then open /dashboard/admin, tab "Plans": it no longer says plans are not set up. Assign a
-- plan to a test account and sign in with it: the dashboard shows the plan.
--
-- Removal, if ever needed (the app falls back on its own; this deletes every plan record):
--   drop table if exists public.client_plans;
--   drop function if exists public.client_plans_set_updated_at();

create table if not exists public.client_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null constraint client_plans_plan_check check (plan in ('starter', 'growth', 'pro')),
  status text not null default 'active'
    constraint client_plans_status_check check (status in ('active', 'ended')),
  starts_on date not null default ((now() at time zone 'Europe/Bucharest')::date),
  ends_on date,
  contract_ref text
    constraint client_plans_contract_ref_check check (contract_ref is null or char_length(contract_ref) between 1 and 120),
  assigned_by uuid references auth.users(id) on delete set null,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_plans_dates_check check (ends_on is null or ends_on >= starts_on),
  constraint client_plans_ended_check check ((status = 'ended') = (ended_at is not null))
);

-- One active plan per account; the account's history, newest first.
create unique index if not exists client_plans_one_active
  on public.client_plans (user_id) where status = 'active';
create index if not exists client_plans_user_idx
  on public.client_plans (user_id, created_at desc);

-- updated_at on every change (its own function: the shared ones are left alone).
create or replace function public.client_plans_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.client_plans_set_updated_at() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'client_plans_set_updated_at'
                 and tgrelid = 'public.client_plans'::regclass) then
    create trigger client_plans_set_updated_at before update on public.client_plans
      for each row execute function public.client_plans_set_updated_at();
  end if;
end $$;

-- Clients read their own rows; only the server (service role) writes.
alter table public.client_plans enable row level security;
revoke all on public.client_plans from public, anon, authenticated;
grant select on public.client_plans to authenticated;
grant all on public.client_plans to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'client_plans' and policyname = 'Clients read their own plans') then
    create policy "Clients read their own plans" on public.client_plans
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;
