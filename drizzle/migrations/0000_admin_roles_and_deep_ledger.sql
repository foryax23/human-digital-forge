-- 0000_admin_roles_and_deep_ledger: Lovable's schema for admin roles and the deep research
-- ledger. ALREADY APPLIED in production (Lovable Cloud). Its statements below are unchanged,
-- byte for byte; the only addition is the all-or-nothing guard around them, so running the
-- file again is safe:
--   - every object present (type app_role and the 8 tables) -> it does nothing (NOTICE);
--   - none present (a fresh database)                        -> it creates everything, exactly
--                                                               as the original file did;
--   - some present                                           -> it stops with an error and
--                                                               changes nothing.
-- Why all-or-nothing and not "create ... if not exists" per statement: 0001 later REPLACES
-- claim_admin_role and has_role with stricter versions. A per-statement idempotent re-run of
-- this file would put the older, weaker functions back (create or replace). The guard skips
-- them together with everything else. See drizzle/README.md.
--
-- Drizzle tracks applied migrations by the journal's "when" timestamp, not by this file's
-- content, so this edit does not make drizzle-kit run the file again on a database that has it.
do $migration_0000$
declare
  _m0_present integer;
begin
  select (to_regtype('public.app_role') is not null)::int
       + (to_regclass('public.user_roles') is not null)::int
       + (to_regclass('public.deep_runs') is not null)::int
       + (to_regclass('public.deep_calls') is not null)::int
       + (to_regclass('public.deep_slots') is not null)::int
       + (to_regclass('public.deep_claims') is not null)::int
       + (to_regclass('public.deep_breaker') is not null)::int
       + (to_regclass('public.deep_feedback') is not null)::int
       + (to_regclass('public.deep_call_requests') is not null)::int
    into _m0_present;
  if _m0_present = 9 then
    raise notice '0000_admin_roles_and_deep_ledger is already applied: nothing to do';
    return;
  elsif _m0_present > 0 then
    raise exception '0000_admin_roles_and_deep_ledger: % of its 9 objects (type app_role and 8 tables) already exist. The schema is partial; repair it by hand instead of re-running this file.', _m0_present;
  end if;

-- Roles
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can view their own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- The single owner account becomes admin once its e-mail is confirmed.
create or replace function public.claim_admin_role()
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and lower(email) = 'mihaidandea13@gmail.com'
      and email_confirmed_at is not null
  ) into ok;
  if ok then
    insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
    on conflict do nothing;
  end if;
  return public.has_role(auth.uid(), 'admin');
end $$;
revoke all on function public.claim_admin_role() from public, anon;
grant execute on function public.claim_admin_role() to authenticated;

-- Deep research ledger (server only)
create table public.deep_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cui text not null,
  company_name text,
  relationship text,
  lang text not null default 'ro',
  via text not null,
  ai_mode text not null default 'rules',
  status text not null default 'running',
  budget_usd numeric not null default 0,
  reserved_usd numeric not null default 0,
  spent_usd numeric not null default 0,
  consent jsonb,
  report jsonb,
  report_att text,
  verify_code text unique,
  metrics jsonb,
  error text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index deep_runs_user_idx on public.deep_runs (user_id, created_at desc);
create index deep_runs_day_idx on public.deep_runs (created_at);

create table public.deep_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.deep_runs(id) on delete cascade,
  idem_key text not null,
  attempt integer not null,
  kind text,
  step text,
  model text,
  status text not null default 'reserved',
  reserved_usd numeric not null default 0,
  usd numeric not null default 0,
  usage jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
create index deep_calls_key_idx on public.deep_calls (run_id, idem_key, attempt desc);

create table public.deep_slots (
  run_id uuid not null references public.deep_runs(id) on delete cascade,
  key text not null,
  used integer not null default 0,
  in_flight_at timestamptz,
  result jsonb,
  primary key (run_id, key)
);

create table public.deep_claims (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.deep_runs(id) on delete cascade,
  key text not null,
  units integer not null,
  exclusive boolean not null default true
);

create table public.deep_breaker (
  id integer primary key default 1,
  until timestamptz not null default now(),
  reason text
);

create table public.deep_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.deep_runs(id) on delete cascade,
  user_id uuid not null,
  kind text not null,
  fact_id text,
  message text,
  value jsonb,
  created_at timestamptz not null default now()
);

create table public.deep_call_requests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.deep_runs(id) on delete cascade,
  user_id uuid not null,
  email text,
  phone text not null,
  call_when text not null,
  cui text,
  lang text,
  created_at timestamptz not null default now()
);

grant all on public.deep_runs, public.deep_calls, public.deep_slots, public.deep_claims,
  public.deep_breaker, public.deep_feedback, public.deep_call_requests to service_role;
alter table public.deep_runs enable row level security;
alter table public.deep_calls enable row level security;
alter table public.deep_slots enable row level security;
alter table public.deep_claims enable row level security;
alter table public.deep_breaker enable row level security;
alter table public.deep_feedback enable row level security;
alter table public.deep_call_requests enable row level security;

-- Atomic money reservation (row lock on the run, global lock for the day cap).
create or replace function public.deep_reserve(
  p_run uuid, p_key text, p_kind text, p_step text, p_model text,
  p_usd numeric, p_day_cap numeric, p_day_start timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.deep_runs; prev public.deep_calls; day_total numeric; new_id uuid; next_attempt int := 1;
begin
  select * into r from public.deep_runs where id = p_run for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'run_not_found'); end if;
  if r.status <> 'running' then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  select * into prev from public.deep_calls where run_id = p_run and idem_key = p_key order by attempt desc limit 1;
  if found then
    next_attempt := prev.attempt + 1;
    if prev.status = 'settled' and prev.result is not null and prev.result <> 'null'::jsonb then
      return jsonb_build_object('ok', false, 'reason', 'replay', 'result', prev.result);
    end if;
    if prev.status = 'reserved' and prev.created_at > now() - interval '2 minutes' then
      return jsonb_build_object('ok', false, 'reason', 'in_flight');
    end if;
    if prev.attempt >= 5 then return jsonb_build_object('ok', false, 'reason', 'attempts'); end if;
  end if;
  if exists (select 1 from public.deep_breaker where id = 1 and until > now()) then
    return jsonb_build_object('ok', false, 'reason', 'breaker');
  end if;
  if not (p_usd > 0) or r.spent_usd + r.reserved_usd + p_usd > r.budget_usd + 1e-9 then
    return jsonb_build_object('ok', false, 'reason', 'run_budget');
  end if;
  perform pg_advisory_xact_lock(727001);
  select coalesce(sum(spent_usd + reserved_usd), 0) into day_total from public.deep_runs where created_at >= p_day_start;
  if day_total + p_usd > p_day_cap + 1e-9 then return jsonb_build_object('ok', false, 'reason', 'day_budget'); end if;
  update public.deep_runs set reserved_usd = reserved_usd + p_usd, last_activity_at = now() where id = p_run;
  insert into public.deep_calls (run_id, idem_key, attempt, kind, step, model, status, reserved_usd)
  values (p_run, p_key, next_attempt, p_kind, p_step, p_model, 'reserved', p_usd) returning id into new_id;
  return jsonb_build_object('ok', true, 'callId', new_id);
end $$;

create or replace function public.deep_settle(p_call uuid, p_usd numeric, p_usage jsonb, p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c public.deep_calls;
begin
  select * into c from public.deep_calls where id = p_call and status = 'reserved' for update;
  if not found then return; end if;
  update public.deep_calls set status = 'settled', usd = greatest(p_usd, 0), usage = p_usage, result = p_result where id = p_call;
  update public.deep_runs set reserved_usd = greatest(reserved_usd - c.reserved_usd, 0),
    spent_usd = spent_usd + greatest(p_usd, 0), last_activity_at = now() where id = c.run_id;
end $$;

create or replace function public.deep_finish(p_run uuid, p_status text, p_report jsonb, p_att text, p_code text, p_metrics jsonb, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.deep_runs;
begin
  select * into r from public.deep_runs where id = p_run for update;
  if not found or r.status <> 'running' then return; end if;
  update public.deep_calls set status = 'settled', usd = reserved_usd where run_id = p_run and status = 'reserved';
  update public.deep_runs set spent_usd = spent_usd + reserved_usd, reserved_usd = 0, status = p_status,
    report = p_report, report_att = p_att, verify_code = p_code, metrics = p_metrics, error = p_error,
    last_activity_at = now() where id = p_run;
end $$;

create or replace function public.deep_claim_step(p_run uuid, p_user uuid, p_key text, p_max int, p_units int, p_exclusive boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.deep_runs; s public.deep_slots; units int := greatest(1, coalesce(p_units, 1)); granted int; left_units int; cid uuid;
begin
  select * into r from public.deep_runs where id = p_run for update;
  if not found or r.user_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'run_not_found'); end if;
  if r.status <> 'running' then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  insert into public.deep_slots (run_id, key) values (p_run, p_key) on conflict do nothing;
  select * into s from public.deep_slots where run_id = p_run and key = p_key for update;
  left_units := p_max - s.used;
  if p_exclusive then
    if s.in_flight_at is not null and s.in_flight_at > now() - interval '2 minutes' then
      return jsonb_build_object('ok', false, 'reason', 'in_flight');
    end if;
    if units > left_units then
      if s.result is not null then return jsonb_build_object('ok', false, 'reason', 'replay', 'result', s.result); end if;
      return jsonb_build_object('ok', false, 'reason', 'exhausted');
    end if;
    granted := units;
    update public.deep_slots set used = used + granted, in_flight_at = now() where run_id = p_run and key = p_key;
  else
    granted := least(units, left_units);
    if granted < 1 then return jsonb_build_object('ok', false, 'reason', 'exhausted'); end if;
    update public.deep_slots set used = used + granted where run_id = p_run and key = p_key;
  end if;
  update public.deep_runs set last_activity_at = now() where id = p_run;
  insert into public.deep_claims (run_id, key, units, exclusive) values (p_run, p_key, granted, p_exclusive) returning id into cid;
  return jsonb_build_object('ok', true, 'claimId', cid, 'granted', granted);
end $$;

create or replace function public.deep_settle_step(p_run uuid, p_claim uuid, p_used int, p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c public.deep_claims; used_units int;
begin
  delete from public.deep_claims where id = p_claim and run_id = p_run returning * into c;
  if not found then return; end if;
  if p_used is not null then
    used_units := greatest(0, least(c.units, p_used));
    update public.deep_slots set used = used - (c.units - used_units) where run_id = p_run and key = c.key;
  end if;
  if c.exclusive then update public.deep_slots set in_flight_at = null where run_id = p_run and key = c.key; end if;
  if p_result is not null then update public.deep_slots set result = p_result where run_id = p_run and key = c.key; end if;
end $$;

revoke all on function public.deep_reserve(uuid, text, text, text, text, numeric, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.deep_settle(uuid, numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.deep_finish(uuid, text, jsonb, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.deep_claim_step(uuid, uuid, text, int, int, boolean) from public, anon, authenticated;
revoke all on function public.deep_settle_step(uuid, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.deep_reserve(uuid, text, text, text, text, numeric, numeric, timestamptz) to service_role;
grant execute on function public.deep_settle(uuid, numeric, jsonb, jsonb) to service_role;
grant execute on function public.deep_finish(uuid, text, jsonb, text, text, jsonb, text) to service_role;
grant execute on function public.deep_claim_step(uuid, uuid, text, int, int, boolean) to service_role;
grant execute on function public.deep_settle_step(uuid, uuid, int, jsonb) to service_role;
end
$migration_0000$;
