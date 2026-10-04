-- Stripe webhook ledger: one row per Stripe event the webhook has processed.
--
-- ADDITIVE and OPTIONAL: creates one new table, changes nothing that exists, and can run twice.
-- The webhook (src/routes/api/public/stripe-webhook.ts + src/lib/stripe-webhook.server.ts)
-- works with or without it. With it:
--   - an event Stripe delivers again (retries, replays from the dashboard) is acknowledged
--     without writing a second time (idempotent by event id);
--   - an event older than one already written for the same subscription is acknowledged
--     without being applied, so a late retry cannot turn a canceled subscription back to active.
-- Without it the webhook logs a warning per event and processes as before (the write is an
-- upsert keyed on the e-mail, so a repeated event gives the same row).
--
-- Access: server only. RLS on with no policy, and no grant to anon or authenticated; the
-- service role (which bypasses RLS) reads and writes it.
--
-- HOW TO APPLY (owner): in the Lovable chat, paste:
--   "Apply drizzle/pending/stripe_events.sql exactly as written. It only adds the table
--    public.stripe_events. Do not change it, do not rename anything and add no grant or
--    policy beyond the ones in the file. Then regenerate the Supabase types."
-- Once Lovable's copy appears in drizzle/migrations/, the lead deletes this pending file.
-- Check afterwards (SQL editor), each must answer as noted:
--   select to_regclass('public.stripe_events') is not null;                                  -- true
--   select has_table_privilege('anon', 'public.stripe_events', 'select');                     -- false
--   select has_table_privilege('authenticated', 'public.stripe_events', 'select');            -- false
--   select relrowsecurity from pg_class where oid = 'public.stripe_events'::regclass;         -- true
-- Then send a test event from the Stripe dashboard (Developers > Webhooks > the endpoint >
-- Send test event, e.g. customer.subscription.updated) and see one row appear:
--   select id, type, outcome, processed_at from public.stripe_events order by processed_at desc limit 5;
-- Optional housekeeping (Stripe retries for 3 days, so 90 days of history is plenty):
--   delete from public.stripe_events where processed_at < now() - interval '90 days';
-- Removal, if ever needed (the webhook falls back on its own):
--   drop table if exists public.stripe_events;

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  object_id text,
  stripe_created timestamptz not null,
  livemode boolean not null default false,
  outcome text not null,
  processed_at timestamptz not null default now()
);
create index if not exists stripe_events_object_idx
  on public.stripe_events (object_id, stripe_created desc);

revoke all on public.stripe_events from public, anon, authenticated;
grant all on public.stripe_events to service_role;
alter table public.stripe_events enable row level security;
