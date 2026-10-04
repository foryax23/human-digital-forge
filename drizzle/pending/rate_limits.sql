-- Intake rate limits and daily caps: one shared counter for every Worker isolate.
--
-- ADDITIVE and OPTIONAL: creates one new table and one new function, changes nothing that
-- exists, and can run twice. The app (src/lib/abuse/) works with or without it:
--   - without it, each Worker isolate counts on its own (in memory), so the per-address
--     limits on the contact form, the scan lead gate and the quick scan, and the daily caps
--     on Brave Search, PageSpeed and alert e-mails, only slow a flood down;
--   - with it, the counts are shared, so the limits hold across isolates.
-- The app looks for the function again every 10 minutes, so it takes effect without a deploy.
--
-- What is stored: a bucket name ("contact", "scan.website", "cap:brave"…), a key that is a
-- 128-bit hash of the visitor's address salted with a secret and the UTC day (never the
-- address itself; "all" for the daily caps), the window start and a count. Rows expire with
-- their window and are removed by the function itself (about 1 call in 100 cleans up).
--
-- Access: server only. RLS on with no policy, no grant to anon or authenticated; only the
-- service role (which the server functions use) may call the function or touch the table.
--
-- HOW TO APPLY (owner): in the Lovable chat, paste:
--   "Apply drizzle/pending/rate_limits.sql exactly as written. It only adds the table
--    public.intake_rate_limits and the function public.intake_rate_hit. Do not change it,
--    do not rename anything and add no grant or policy beyond the ones in the file. Then
--    regenerate the Supabase types."
-- Once Lovable's copy appears in drizzle/migrations/, the lead deletes this pending file.
-- Check afterwards (SQL editor), each must answer as noted:
--   select to_regclass('public.intake_rate_limits') is not null;                              -- true
--   select has_table_privilege('anon', 'public.intake_rate_limits', 'select');                 -- false
--   select has_table_privilege('authenticated', 'public.intake_rate_limits', 'select');        -- false
--   select has_function_privilege('anon', 'public.intake_rate_hit(text,text,integer)', 'execute');          -- false
--   select has_function_privilege('authenticated', 'public.intake_rate_hit(text,text,integer)', 'execute'); -- false
--   select relrowsecurity from pg_class where oid = 'public.intake_rate_limits'::regclass;      -- true
--   select public.intake_rate_hit('selftest', 'x', 60);                                        -- 1, then 2 on a second run within the minute
--   delete from public.intake_rate_limits where bucket = 'selftest';
-- What it counts today (no personal data):
--   select bucket, count(*) as keys, sum(hits) as hits from public.intake_rate_limits
--     where expires_at > now() group by bucket order by hits desc;
-- Removal, if ever needed (the app falls back to memory on its own):
--   drop function if exists public.intake_rate_hit(text, text, integer);
--   drop table if exists public.intake_rate_limits;

create table if not exists public.intake_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  expires_at timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key_hash, window_seconds, window_start)
);
create index if not exists intake_rate_limits_expires_idx
  on public.intake_rate_limits (expires_at);

revoke all on public.intake_rate_limits from public, anon, authenticated;
grant all on public.intake_rate_limits to service_role;
alter table public.intake_rate_limits enable row level security;

-- Counts one hit in the fixed window of p_window_seconds that holds now() (windows start at
-- multiples of their length since 1970-01-01 UTC, so days turn at 00:00 UTC) and returns the
-- window's count after this hit. Atomic per (bucket, key, window).
create or replace function public.intake_rate_hit(
  p_bucket text,
  p_key text,
  p_window_seconds integer
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) not between 1 and 64
     or p_key is null or length(p_key) not between 1 and 64
     or p_window_seconds is null or p_window_seconds not between 1 and 604800 then
    raise exception 'intake_rate_hit: bad arguments' using errcode = '22023';
  end if;

  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.intake_rate_limits as r
    (bucket, key_hash, window_start, window_seconds, expires_at, hits)
  values
    (p_bucket, p_key, v_start, p_window_seconds, v_start + make_interval(secs => p_window_seconds), 1)
  on conflict (bucket, key_hash, window_seconds, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if random() < 0.01 then
    delete from public.intake_rate_limits where expires_at < now();
  end if;

  return v_hits;
end;
$$;

revoke all on function public.intake_rate_hit(text, text, integer) from public, anon, authenticated;
grant execute on function public.intake_rate_hit(text, text, integer) to service_role;
