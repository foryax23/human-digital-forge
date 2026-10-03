-- Deep research additions to 0000_admin_roles_and_deep_ledger.sql (Lovable's applied schema,
-- the source of truth). ADDITIVE: no table, column or row is dropped or rewritten, 0000 itself
-- is not edited, and the app works before and after this file is applied.
--
-- PART 1, SECURITY (recommended):
--   1a. claim_admin_role grants the admin role only to the owner's GOOGLE identity
--       (auth.identities: provider google, verified e-mail mihaidandea13@gmail.com). Until now
--       any account whose auth.users.email is that address became admin once confirmed,
--       including an e-mail/password sign-up while e-mail auto-confirm is on. A role already
--       granted is kept: the function still answers has_role for the caller.
--   1b. has_role answers anon and signed-in clients about THEMSELVES only (it told anyone with
--       the publishable key whether any user ID is an admin). RLS policies written as
--       has_role(auth.uid(), ...) keep working, and so do the server (service role, which the
--       server now uses to read user_roles directly) and the SQL editor.
--   1c. deep_runs.user_id and user_roles.user_id reference auth.users ON DELETE CASCADE, NOT VALID
--       (existing rows are not checked). Deleting an account then deletes its runs, reports,
--       consent records, feedback and call requests (through the run_id cascade of 0000) and
--       its role, instead of keeping them until the 90-day purge. OWNER DECISION: this also
--       deletes that account's "Suna-ma" requests at once. To leave it out, delete the 1c block.
--
-- PART 2, OPTIONAL ENGINE FUNCTIONS. The server (src/lib/deep/persist-tables.server.ts) detects a
-- missing function and uses plain table operations instead. Applying them moves two rules of the
-- deep research engine into the database, where they are exact:
--   2a. deep_start_run: starts a run with its caps (one active run per account, one report per
--       company per account per day, the per-account and all-accounts daily run caps) under the
--       same advisory lock deep_reserve already takes for the daily budget. Without it the
--       server inserts then counts, which can let one extra run through when two starts race.
--   2b. deep_reclaim_step: when a step died while holding its claim (a closed tab, a cancelled
--       request), gives the claim's units back after 2 minutes so the retry can run, exactly as
--       the engine's own ledger does. Without it the server does the same with a
--       compare-and-swap on deep_slots.
--
-- Security model of the new functions: as 0000. SECURITY DEFINER with a fixed search_path; the
-- deep_* functions have EXECUTE revoked from public, anon and authenticated and granted to
-- service_role only (the server).
--
-- BEFORE APPLYING (owner, Lovable Cloud SQL editor, read only):
--   -- The owner's Google identity, which 1a requires: one row, provider google, verified true.
--   select i.provider, i.identity_data->>'email' as email, i.identity_data->>'email_verified' as verified
--     from auth.identities i join auth.users u on u.id = i.user_id
--    where lower(u.email) = 'mihaidandea13@gmail.com';
--   -- Who holds the admin role now: exactly one row, the owner's Google account.
--   select ur.user_id, u.email, u.raw_app_meta_data->'providers' as providers, ur.created_at
--     from public.user_roles ur join auth.users u on u.id = ur.user_id where ur.role = 'admin';
--   If the second query shows any other account, remove that row first (Lovable chat:
--   "delete the admin role of user <id> from public.user_roles").
--
-- HOW TO APPLY (owner): in the Lovable chat, paste:
--   "Apply the pending drizzle migration drizzle/migrations/0001_deep_research_additions.sql
--    exactly as written. It replaces two functions (claim_admin_role, has_role) with stricter
--    versions, adds two foreign keys to auth.users and two new functions. Do not change it, do
--    not rename anything and do not add any grant or policy. Then regenerate the Supabase types."
-- Check afterwards (SQL editor), each must answer as noted:
--   select has_function_privilege('anon', 'public.deep_start_run(uuid,text,text,text,text,text,numeric,text,jsonb,integer,integer,boolean,timestamptz)', 'execute');  -- false
--   select has_function_privilege('service_role', 'public.deep_reclaim_step(uuid,uuid,text)', 'execute');  -- true
--   select has_function_privilege('authenticated', 'public.claim_admin_role()', 'execute');  -- true
--   select count(*) from pg_constraint where conname in ('deep_runs_user_fk', 'user_roles_user_fk');  -- 2
--   Then sign in with Google: the Admin entry is still in the dashboard menu.
-- Later, optional: validate the foreign keys once no orphan rows remain (each count must be 0):
--   select count(*) from public.deep_runs r where not exists (select 1 from auth.users u where u.id = r.user_id);
--   select count(*) from public.user_roles r where not exists (select 1 from auth.users u where u.id = r.user_id);
--   alter table public.deep_runs validate constraint deep_runs_user_fk;
--   alter table public.user_roles validate constraint user_roles_user_fk;
-- Removal of PART 2, if ever needed (the server falls back on its own):
--   drop function if exists public.deep_start_run(uuid, text, text, text, text, text, numeric, text, jsonb, integer, integer, boolean, timestamptz),
--     public.deep_reclaim_step(uuid, uuid, text);

-- 1a. Admin role for the owner's Google identity only.
create or replace function public.claim_admin_role()
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select exists (
    select 1 from auth.identities i
    where i.user_id = auth.uid()
      and i.provider = 'google'
      and lower(i.identity_data->>'email') = 'mihaidandea13@gmail.com'
      and i.identity_data->>'email_verified' = 'true'
  ) into ok;
  if ok then
    insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
    on conflict do nothing;
  end if;
  return public.has_role(auth.uid(), 'admin');
end $$;
revoke all on function public.claim_admin_role() from public, anon;
grant execute on function public.claim_admin_role() to authenticated;

-- 1b. has_role: clients learn their own roles only.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
           in ('anon', 'authenticated')
         and _user_id is distinct from auth.uid()
      then false
    else exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
  end
$$;

-- 1c. Account deletion removes the account's deep research data and its role.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deep_runs_user_fk'
                 and conrelid = 'public.deep_runs'::regclass) then
    alter table public.deep_runs add constraint deep_runs_user_fk
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_roles_user_fk'
                 and conrelid = 'public.user_roles'::regclass) then
    alter table public.user_roles add constraint user_roles_user_fk
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

-- 2a, 2b. Optional engine functions.
create or replace function public.deep_start_run(
  p_user uuid, p_cui text, p_company text, p_relationship text, p_lang text, p_via text,
  p_budget numeric, p_ai_mode text, p_consent jsonb,
  p_user_cap integer, p_global_cap integer, p_allow_same_company boolean, p_day_start timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare prev uuid; new_id uuid;
begin
  -- The lock deep_reserve takes for the daily budget: starts are counted one at a time.
  perform pg_advisory_xact_lock(727001);
  if exists (
    select 1 from public.deep_runs r
    where r.user_id = p_user and r.status = 'running'
      and greatest(r.created_at, r.last_activity_at) > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_running');
  end if;
  if not coalesce(p_allow_same_company, false) then
    select r.id into prev from public.deep_runs r
    where r.user_id = p_user and r.cui = p_cui and r.created_at >= p_day_start
      and r.status in ('succeeded', 'partial')
    order by r.created_at desc limit 1;
    if prev is not null then
      return jsonb_build_object('ok', false, 'reason', 'same_company_today', 'replayRunId', prev);
    end if;
  end if;
  if (select count(*) from public.deep_runs r
      where r.user_id = p_user and r.created_at >= p_day_start and r.status <> 'canceled') >= p_user_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap_user');
  end if;
  if p_via <> 'admin' and (select count(*) from public.deep_runs r
      where r.created_at >= p_day_start and r.via <> 'admin' and r.status <> 'canceled') >= p_global_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap_global');
  end if;
  insert into public.deep_runs (user_id, cui, company_name, relationship, lang, via, ai_mode, budget_usd, consent)
  values (p_user, p_cui, left(p_company, 200), p_relationship, coalesce(p_lang, 'ro'), p_via,
          coalesce(p_ai_mode, 'rules'), p_budget, p_consent)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'runId', new_id);
end $$;

create or replace function public.deep_reclaim_step(p_run uuid, p_user uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.deep_runs; s public.deep_slots; back int;
begin
  -- Same lock order as deep_claim_step: the run row, then the slot.
  select * into r from public.deep_runs where id = p_run for update;
  if not found or r.user_id <> p_user or r.status <> 'running' then return false; end if;
  select * into s from public.deep_slots where run_id = p_run and key = p_key for update;
  if not found or s.in_flight_at is null or s.in_flight_at > now() - interval '2 minutes'
     or s.result is not null then
    return false;
  end if;
  with gone as (
    delete from public.deep_claims where run_id = p_run and key = p_key and exclusive returning units
  )
  select coalesce(sum(units), 0) into back from gone;
  update public.deep_slots set used = greatest(used - greatest(back, 1), 0), in_flight_at = null
  where run_id = p_run and key = p_key;
  return true;
end $$;

revoke all on function public.deep_start_run(uuid, text, text, text, text, text, numeric, text, jsonb, integer, integer, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.deep_reclaim_step(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.deep_start_run(uuid, text, text, text, text, text, numeric, text, jsonb, integer, integer, boolean, timestamptz) to service_role;
grant execute on function public.deep_reclaim_step(uuid, uuid, text) to service_role;
