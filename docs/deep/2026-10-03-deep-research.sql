-- Vortex Scan · Cercetare aprofundată v1 · server-held runs, paid calls, step claims, feedback, breaker
-- Version 2026-10-03 (schema version 1). Apply once through Lovable (chat, or Cloud → SQL editor).
--
-- HOW TO APPLY (owner, about 5 minutes; nothing breaks if you never do it):
--   1. In the Lovable chat, paste exactly:
--        Apply the SQL in docs/deep/2026-10-03-deep-research.sql to Lovable Cloud as a reviewed
--        migration, exactly as written. Do not rename anything, do not change the checks, policies,
--        grants or functions, and do not add any policy that lets anon or authenticated users read
--        these tables. Then regenerate the Supabase types.
--      Approve the migration Lovable shows you.
--      Alternative: More → Cloud → SQL editor, paste this whole file, press Run.
--   2. Run the three checks at the end of this file; each must give the answer written next to it.
--   3. Open /scan/deep as admin: within 5 minutes the admin panel shows "Salvare: pe server".
--      Runs started before keep their old storage until they finish. Nothing else changes.
--
-- WHAT IT GIVES YOU: reports kept on the server by run (they follow you across devices), PDF
-- verification codes that can be checked at /scan/deep?verify=<code>, an exact daily spend limit
-- and exact run caps across all server instances (one lock), and paid AI calls that are never paid
-- twice. Without these tables the app uses its stopgap: rows in audit_leads (never leads).
--
-- SECURITY: identical to public.audit_leads. Row level security on, a restrictive deny-all policy
-- for anon and authenticated, no grants to them; only the server (service_role) reads and writes.
-- This file is deliberately not in supabase/migrations/ so it cannot confuse Lovable's migration
-- ledger. A git revert never undoes database changes: the removal statements are at the end.

begin;

create table if not exists public.deep_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  cui               text not null check (cui ~ '^[0-9]{2,10}$'),
  company_name      text check (char_length(company_name) <= 200),
  relationship      text not null
                    check (relationship in ('proprietar','angajat','client_furnizor','concurent','altceva')),
  lang              text not null default 'ro' check (lang in ('ro','en')),
  access_via        text not null check (access_via in ('admin','code','open','premium','free')),
  status            text not null default 'running'
                    check (status in ('running','partial','succeeded','failed','canceled')),
  ai_mode           text not null default 'ai' check (ai_mode in ('ai','rules')),
  budget_usd        numeric(8,4) not null check (budget_usd > 0 and budget_usd <= 10),
  reserved_usd      numeric(10,6) not null default 0 check (reserved_usd >= 0),
  spent_usd         numeric(10,6) not null default 0 check (spent_usd >= 0),
  report            jsonb check (report is null or pg_column_size(report) <= 1048576),
  report_att        text check (char_length(report_att) <= 128),
  verify_code       text unique check (char_length(verify_code) <= 16),
  consent           jsonb not null default '{}'::jsonb,
  metrics           jsonb not null default '{}'::jsonb,
  error             text check (char_length(error) <= 2000),
  created_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  finished_at       timestamptz,
  expires_at        timestamptz not null default (now() + interval '90 days')
);
create index if not exists deep_runs_user_created_idx on public.deep_runs (user_id, created_at desc);
create index if not exists deep_runs_created_idx      on public.deep_runs (created_at desc);
create index if not exists deep_runs_expires_idx      on public.deep_runs (expires_at);

create table if not exists public.deep_calls (
  id                  bigint generated always as identity primary key,
  run_id              uuid not null references public.deep_runs (id) on delete cascade,
  idem_key            text not null check (char_length(idem_key) <= 200),
  attempt             smallint not null default 1 check (attempt between 1 and 5),
  kind                text not null check (kind in ('llm','maps')),
  step                text not null check (char_length(step) <= 40),
  model               text check (char_length(model) <= 80),
  status              text not null default 'reserved' check (status in ('reserved','settled')),
  reserved_usd        numeric(10,6) not null check (reserved_usd > 0),
  usd                 numeric(10,6) not null default 0 check (usd >= 0),
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  cache_read_tokens   integer not null default 0,
  cache_write_tokens  integer not null default 0,
  result              jsonb check (result is null or pg_column_size(result) <= 65536),
  created_at          timestamptz not null default now(),
  settled_at          timestamptz,
  unique (run_id, idem_key, attempt)
);
create index if not exists deep_calls_run_idx on public.deep_calls (run_id);

-- Run-level step claims: a step (money, site, a crawl batch, a competitor…) is claimed before it
-- runs, so a retried or parallel request can never multiply ANAF calls, crawl traffic or competitor
-- fetches; a used-up step replays its stored, attested result.
create table if not exists public.deep_steps (
  run_id        uuid not null references public.deep_runs (id) on delete cascade,
  step_key      text not null check (char_length(step_key) <= 80),
  used          integer not null default 0 check (used >= 0),
  in_flight_at  timestamptz,
  result        jsonb check (result is null or pg_column_size(result) <= 131072),
  updated_at    timestamptz not null default now(),
  primary key (run_id, step_key)
);

create table if not exists public.deep_claims (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references public.deep_runs (id) on delete cascade,
  step_key    text not null check (char_length(step_key) <= 80),
  units       integer not null check (units >= 1),
  exclusive   boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists deep_claims_run_idx on public.deep_claims (run_id);

create table if not exists public.deep_feedback (
  id          bigint generated always as identity primary key,
  run_id      uuid references public.deep_runs (id) on delete set null,
  user_id     uuid references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('useful_yes','useful_no','error_report','correction',
                'monitoring_interest','price_signal','cta_click','competitor_edit')),
  fact_id     text check (char_length(fact_id) <= 120),
  message     text check (char_length(message) <= 1000),
  value       jsonb check (value is null or pg_column_size(value) <= 4096),
  created_at  timestamptz not null default now()
);
create index if not exists deep_feedback_user_created_idx on public.deep_feedback (user_id, created_at desc);

create table if not exists public.deep_settings (
  key         text primary key check (key in ('breaker')),
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Start a run atomically: concurrency, same-company and daily caps under one lock.
create or replace function public.deep_start_run(
  p_user uuid, p_cui text, p_company text, p_relationship text, p_lang text, p_via text,
  p_budget numeric, p_ai_mode text, p_consent jsonb,
  p_user_cap integer, p_global_cap integer, p_allow_same_company boolean)
returns table (run_id uuid, reason text, replay_run uuid)
language plpgsql security invoker set search_path = public as $$
declare
  t timestamptz := date_trunc('day', now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest';
  prev uuid;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('vortex-deep-day'));
  if exists (select 1 from deep_runs r where r.user_id = p_user and r.status = 'running'
             and greatest(r.created_at, r.last_activity_at) > now() - interval '10 minutes') then
    return query select null::uuid, 'already_running'::text, null::uuid; return;
  end if;
  if not p_allow_same_company then
    select r.id into prev from deep_runs r
     where r.user_id = p_user and r.cui = p_cui and r.created_at >= t
       and r.status in ('succeeded','partial')
     order by r.created_at desc limit 1;
    if prev is not null then
      return query select null::uuid, 'same_company_today'::text, prev; return;
    end if;
  end if;
  if (select count(*) from deep_runs r where r.user_id = p_user and r.created_at >= t
        and r.status <> 'canceled') >= p_user_cap then
    return query select null::uuid, 'daily_cap_user'::text, null::uuid; return;
  end if;
  if p_via <> 'admin' and (select count(*) from deep_runs r where r.created_at >= t
        and r.access_via <> 'admin' and r.status <> 'canceled') >= p_global_cap then
    return query select null::uuid, 'daily_cap_global'::text, null::uuid; return;
  end if;
  insert into deep_runs (user_id, cui, company_name, relationship, lang, access_via, budget_usd, ai_mode, consent)
  values (p_user, p_cui, p_company, p_relationship, p_lang, p_via, p_budget, p_ai_mode, p_consent)
  returning id into new_id;
  return query select new_id, 'ok'::text, null::uuid;
end $$;

-- Reserve spend for one paid call: idempotency, breaker, run budget and day budget under one lock.
create or replace function public.deep_reserve(
  p_run uuid, p_idem text, p_kind text, p_step text, p_model text, p_usd numeric, p_day_cap numeric)
returns table (call_id bigint, reason text, replay jsonb)
language plpgsql security invoker set search_path = public as $$
declare
  r deep_runs%rowtype;
  c deep_calls%rowtype;
  brk jsonb;
  day_total numeric;
  new_id bigint;
  t timestamptz := date_trunc('day', now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest';
begin
  perform pg_advisory_xact_lock(hashtext('vortex-deep-day'));
  select * into r from deep_runs where id = p_run for update;
  if not found then return query select null::bigint, 'run_not_found'::text, null::jsonb; return; end if;
  if r.status <> 'running' then return query select null::bigint, 'run_closed'::text, null::jsonb; return; end if;
  select * into c from deep_calls where run_id = p_run and idem_key = p_idem order by attempt desc limit 1;
  if found then
    if c.status = 'settled' and c.result is not null then
      return query select c.id, 'replay'::text, c.result; return;
    end if;
    if c.status = 'reserved' and c.created_at > now() - interval '2 minutes' then
      return query select null::bigint, 'in_flight'::text, null::jsonb; return;
    end if;
    if c.attempt >= 5 then return query select null::bigint, 'attempts'::text, null::jsonb; return; end if;
  end if;
  select value into brk from deep_settings where key = 'breaker';
  if brk is not null and (brk->>'until')::timestamptz > now() then
    return query select null::bigint, 'breaker'::text, null::jsonb; return;
  end if;
  if p_usd <= 0 or r.spent_usd + r.reserved_usd + p_usd > r.budget_usd then
    return query select null::bigint, 'run_budget'::text, null::jsonb; return;
  end if;
  select coalesce(sum(x.spent_usd + x.reserved_usd), 0) into day_total from deep_runs x where x.created_at >= t;
  if day_total + p_usd > p_day_cap then
    return query select null::bigint, 'day_budget'::text, null::jsonb; return;
  end if;
  update deep_runs set reserved_usd = reserved_usd + p_usd, last_activity_at = now() where id = p_run;
  insert into deep_calls (run_id, idem_key, attempt, kind, step, model, reserved_usd)
  values (p_run, p_idem, coalesce(c.attempt, 0) + 1, p_kind, p_step, p_model, p_usd)
  returning id into new_id;
  return query select new_id, 'ok'::text, null::jsonb;
end $$;

-- Record the real cost of a reserved call (sum of usage.iterations, priced by model).
create or replace function public.deep_settle(
  p_call bigint, p_usd numeric, p_in integer, p_out integer, p_cache_read integer, p_cache_write integer, p_result jsonb)
returns numeric
language plpgsql security invoker set search_path = public as $$
declare v_run uuid; v_reserved numeric; v_spent numeric;
begin
  update deep_calls
     set status = 'settled', usd = greatest(p_usd, 0), input_tokens = p_in, output_tokens = p_out,
         cache_read_tokens = p_cache_read, cache_write_tokens = p_cache_write, result = p_result, settled_at = now()
   where id = p_call and status = 'reserved'
  returning run_id, reserved_usd into v_run, v_reserved;
  if not found then return null; end if;
  update deep_runs
     set reserved_usd = greatest(reserved_usd - v_reserved, 0),
         spent_usd = spent_usd + greatest(p_usd, 0), last_activity_at = now()
   where id = v_run
  returning spent_usd into v_spent;
  return v_spent;
end $$;

-- Claim a step of a run before it runs (same rules as the engine's in-memory ledger):
-- exclusive claims: one unsettled claim per key (a younger one than 2 minutes is "in_flight"),
-- `units` counted against `max`; a used-up key replays its last result, else "exhausted".
-- counter claims (exclusive false): grants least(units, max - used), at least 1, else "exhausted".
create or replace function public.deep_claim_step(
  p_run uuid, p_user uuid, p_key text, p_max integer, p_units integer, p_exclusive boolean)
returns table (claim_id bigint, reason text, granted integer, replay jsonb)
language plpgsql security invoker set search_path = public as $$
declare
  r deep_runs%rowtype;
  s deep_steps%rowtype;
  v_units integer := greatest(1, coalesce(p_units, 1));
  v_left integer;
  v_granted integer;
  new_id bigint;
begin
  select * into r from deep_runs where id = p_run for update;
  if not found or r.user_id <> p_user then
    return query select null::bigint, 'run_not_found'::text, 0, null::jsonb; return;
  end if;
  if r.status <> 'running' then
    return query select null::bigint, 'run_closed'::text, 0, null::jsonb; return;
  end if;
  insert into deep_steps (run_id, step_key) values (p_run, p_key) on conflict (run_id, step_key) do nothing;
  select * into s from deep_steps where run_id = p_run and step_key = p_key for update;
  -- An exclusive claim whose step died before settling gives its units back after 2 minutes.
  if coalesce(p_exclusive, true) and s.in_flight_at is not null
     and s.in_flight_at <= now() - interval '2 minutes' and s.result is null then
    with gone as (
      delete from deep_claims where run_id = p_run and step_key = p_key and exclusive
      returning units)
    update deep_steps
       set used = greatest(used - coalesce((select sum(units) from gone), 1), 0),
           in_flight_at = null, updated_at = now()
     where run_id = p_run and step_key = p_key
    returning * into s;
  end if;
  v_left := p_max - s.used;
  if coalesce(p_exclusive, true) then
    if s.in_flight_at is not null and s.in_flight_at > now() - interval '2 minutes' then
      return query select null::bigint, 'in_flight'::text, 0, null::jsonb; return;
    end if;
    if v_units > v_left then
      if s.result is not null then
        return query select null::bigint, 'replay'::text, 0, s.result; return;
      end if;
      return query select null::bigint, 'exhausted'::text, 0, null::jsonb; return;
    end if;
    v_granted := v_units;
    update deep_steps set used = used + v_granted, in_flight_at = now(), updated_at = now()
     where run_id = p_run and step_key = p_key;
  else
    v_granted := least(v_units, v_left);
    if v_granted < 1 then
      return query select null::bigint, 'exhausted'::text, 0, null::jsonb; return;
    end if;
    update deep_steps set used = used + v_granted, updated_at = now()
     where run_id = p_run and step_key = p_key;
  end if;
  update deep_runs set last_activity_at = now() where id = p_run;
  insert into deep_claims (run_id, step_key, units, exclusive)
  values (p_run, p_key, v_granted, coalesce(p_exclusive, true))
  returning id into new_id;
  return query select new_id, 'ok'::text, v_granted, null::jsonb;
end $$;

-- End a claim: `p_used` (≤ granted) gives back the unused units; `p_result` is kept for replay.
create or replace function public.deep_settle_step(
  p_run uuid, p_claim bigint, p_used integer, p_result jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare c deep_claims%rowtype; v_used integer;
begin
  delete from deep_claims where id = p_claim and run_id = p_run returning * into c;
  if not found then return; end if;
  if p_used is not null then
    v_used := greatest(0, least(c.units, p_used));
    update deep_steps set used = greatest(0, used - (c.units - v_used)), updated_at = now()
     where run_id = p_run and step_key = c.step_key;
  end if;
  if c.exclusive then
    update deep_steps set in_flight_at = null, updated_at = now()
     where run_id = p_run and step_key = c.step_key;
  end if;
  if p_result is not null then
    update deep_steps set result = p_result, updated_at = now()
     where run_id = p_run and step_key = c.step_key;
  end if;
end $$;

-- Close a run: unsettled reservations count as spent; the final status is set only here.
create or replace function public.deep_finish(
  p_run uuid, p_status text, p_report jsonb, p_att text, p_code text, p_metrics jsonb, p_error text)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  update deep_calls set status = 'settled', usd = reserved_usd, settled_at = now()
   where run_id = p_run and status = 'reserved';
  update deep_runs
     set spent_usd = spent_usd + reserved_usd, reserved_usd = 0, status = p_status, report = p_report,
         report_att = p_att, verify_code = p_code, metrics = coalesce(p_metrics, '{}'::jsonb),
         error = p_error, finished_at = now(), last_activity_at = now()
   where id = p_run and status = 'running';
end $$;

-- Stop all paid calls for a while (402 or spend-limit errors).
create or replace function public.deep_trip_breaker(p_minutes integer, p_reason text)
returns void
language sql security invoker set search_path = public as $$
  insert into deep_settings (key, value, updated_at)
  values ('breaker', jsonb_build_object('until', now() + make_interval(mins => p_minutes), 'reason', left(p_reason, 200)), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
$$;

-- Today's counters for the UI (Europe/Bucharest).
create or replace function public.deep_day_stats(p_user uuid)
returns table (user_runs integer, all_runs integer, all_usd numeric)
language sql stable security invoker set search_path = public as $$
  with t as (select date_trunc('day', now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest' as start)
  select
    (select count(*)::int from deep_runs r, t where r.user_id = p_user and r.created_at >= t.start and r.status <> 'canceled'),
    (select count(*)::int from deep_runs r, t where r.created_at >= t.start and r.access_via <> 'admin' and r.status <> 'canceled'),
    (select coalesce(sum(r.spent_usd + r.reserved_usd), 0) from deep_runs r, t where r.created_at >= t.start);
$$;

-- Lazy retention, called by the server at most once an hour: runs (with their calls, steps and
-- claims) after 90 days, feedback after 12 months.
create or replace function public.deep_purge_expired()
returns integer
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  delete from deep_runs where expires_at < now();
  get diagnostics n = row_count;
  delete from deep_feedback where created_at < now() - interval '12 months';
  return n;
end $$;

alter table public.deep_runs     enable row level security;
alter table public.deep_calls    enable row level security;
alter table public.deep_steps    enable row level security;
alter table public.deep_claims   enable row level security;
alter table public.deep_feedback enable row level security;
alter table public.deep_settings enable row level security;

drop policy if exists deep_runs_deny_clients     on public.deep_runs;
drop policy if exists deep_calls_deny_clients    on public.deep_calls;
drop policy if exists deep_steps_deny_clients    on public.deep_steps;
drop policy if exists deep_claims_deny_clients   on public.deep_claims;
drop policy if exists deep_feedback_deny_clients on public.deep_feedback;
drop policy if exists deep_settings_deny_clients on public.deep_settings;
create policy deep_runs_deny_clients     on public.deep_runs     as restrictive for all to anon, authenticated using (false) with check (false);
create policy deep_calls_deny_clients    on public.deep_calls    as restrictive for all to anon, authenticated using (false) with check (false);
create policy deep_steps_deny_clients    on public.deep_steps    as restrictive for all to anon, authenticated using (false) with check (false);
create policy deep_claims_deny_clients   on public.deep_claims   as restrictive for all to anon, authenticated using (false) with check (false);
create policy deep_feedback_deny_clients on public.deep_feedback as restrictive for all to anon, authenticated using (false) with check (false);
create policy deep_settings_deny_clients on public.deep_settings as restrictive for all to anon, authenticated using (false) with check (false);

revoke all on table public.deep_runs, public.deep_calls, public.deep_steps, public.deep_claims,
  public.deep_feedback, public.deep_settings from anon, authenticated;
grant  all on table public.deep_runs, public.deep_calls, public.deep_steps, public.deep_claims,
  public.deep_feedback, public.deep_settings to service_role;
grant usage, select on sequence public.deep_calls_id_seq, public.deep_claims_id_seq,
  public.deep_feedback_id_seq to service_role;

revoke execute on function
  public.deep_start_run(uuid, text, text, text, text, text, numeric, text, jsonb, integer, integer, boolean),
  public.deep_reserve(uuid, text, text, text, text, numeric, numeric),
  public.deep_settle(bigint, numeric, integer, integer, integer, integer, jsonb),
  public.deep_claim_step(uuid, uuid, text, integer, integer, boolean),
  public.deep_settle_step(uuid, bigint, integer, jsonb),
  public.deep_finish(uuid, text, jsonb, text, text, jsonb, text),
  public.deep_trip_breaker(integer, text),
  public.deep_day_stats(uuid),
  public.deep_purge_expired()
  from public, anon, authenticated;
grant execute on function
  public.deep_start_run(uuid, text, text, text, text, text, numeric, text, jsonb, integer, integer, boolean),
  public.deep_reserve(uuid, text, text, text, text, numeric, numeric),
  public.deep_settle(bigint, numeric, integer, integer, integer, integer, jsonb),
  public.deep_claim_step(uuid, uuid, text, integer, integer, boolean),
  public.deep_settle_step(uuid, bigint, integer, jsonb),
  public.deep_finish(uuid, text, jsonb, text, text, jsonb, text),
  public.deep_trip_breaker(integer, text),
  public.deep_day_stats(uuid),
  public.deep_purge_expired()
  to service_role;

commit;

-- Checks after applying (all must hold):
--   select relname, relrowsecurity from pg_class where relname like 'deep\_%' and relkind = 'r';  -- 6 rows, all true
--   select has_table_privilege('anon', 'public.deep_runs', 'select');                             -- false
--   select has_function_privilege('anon', 'public.deep_reserve(uuid,text,text,text,text,numeric,numeric)', 'execute'); -- false
-- Removal (only if you decide to drop server storage; git reverts never undo database changes):
--   drop table if exists public.deep_feedback, public.deep_claims, public.deep_steps, public.deep_calls,
--     public.deep_settings, public.deep_runs cascade;
--   drop function if exists public.deep_start_run(uuid, text, text, text, text, text, numeric, text, jsonb, integer, integer, boolean),
--     public.deep_reserve(uuid, text, text, text, text, numeric, numeric),
--     public.deep_settle(bigint, numeric, integer, integer, integer, integer, jsonb),
--     public.deep_claim_step(uuid, uuid, text, integer, integer, boolean),
--     public.deep_settle_step(uuid, bigint, integer, jsonb),
--     public.deep_finish(uuid, text, jsonb, text, text, jsonb, text),
--     public.deep_trip_breaker(integer, text), public.deep_day_stats(uuid), public.deep_purge_expired();
