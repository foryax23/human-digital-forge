# drizzle

SQL for the Lovable Cloud database (Supabase). It is applied by the owner through the Lovable chat
("Apply drizzle/pending/<file> exactly as written"), never by hand from a laptop and never by an
engineer.

- `migrations/` is the record of what is **applied**. Lovable's migration tool writes it: when it
  applies SQL it saves its own numbered copy here, with a journal entry and a snapshot.
- `pending/` holds SQL that is **written but not applied yet**. Once Lovable applies a file and
  its copy lands in `migrations/`, delete the file from `pending/`.

Do not put new SQL straight into `migrations/`. That is how `0001` got recorded twice: Lovable
applied it and saved the same SQL again as `0002_deep_research_additions.sql` (removed in
`dbdde71`).

| File                                              | State                     | What it does                                                                                       |
| ------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `migrations/0000_admin_roles_and_deep_ledger.sql` | applied                   | `app_role`, `user_roles`, `has_role`, `claim_admin_role`, the `deep_*` ledger tables and functions |
| `migrations/0001_deep_research_additions.sql`     | applied (2026-10-04)      | stricter `claim_admin_role` and `has_role`, two foreign keys, two optional engine functions        |
| `pending/client_plans.sql`                        | pending (owner)           | `client_plans`: the plan an admin assigns to a client account after the contract                   |
| `pending/stripe_events.sql`                       | pending (owner), optional | `stripe_events`, the Stripe webhook's ledger (duplicate and out-of-order guard)                    |

## Rules

- **Additive only.** Never change what an applied file does. A schema change is a new file that
  adds; it does not drop, rename or rewrite existing objects or rows.
- **The app must work before and after a file is applied.** Code feature-detects new tables and
  functions (PostgREST `PGRST205`/`PGRST202`, Postgres `42P01`/`42883`) and falls back.
- **Every new file can run twice** without error and without changing the result.
- Journal entries and snapshots in `migrations/meta/` come from Lovable's tool. If one is ever
  written by hand: copy the previous snapshot, new `id`, `prevId` = the previous snapshot's `id`,
  and a journal `when` later than every existing entry. `drizzle/schema.ts` is empty, so the
  snapshots carry no tables.

## How drizzle decides what to run

`drizzle-kit migrate` (and drizzle-orm's migrator) compares the journal's `when` timestamp with the
newest row of `drizzle.__drizzle_migrations` and runs only the entries with a later `when`, all in
one transaction. It does not compare file contents: editing an applied file does not make drizzle
run it again. Other runners (a Lovable process, `psql -f`, the Supabase CLI) may behave
differently, which is why re-run safety matters.

## 0000 and re-runs

`0000` was not written to run twice (its first statement, `create type`, fails on a second run,
and the transaction rolls back). It now has an **all-or-nothing guard** around its unchanged
statements:

- all 9 objects present (type `app_role` and the 8 tables): it does nothing;
- none present (a fresh database): it runs exactly the original statements;
- some present: it raises an error and changes nothing.

A per-statement "idempotent" version (`create table if not exists`, `create or replace function`)
would be **wrong** here: re-running it after `0001` would put back the older, weaker
`claim_admin_role` (any confirmed account with the owner's e-mail becomes admin) and `has_role`
(answers about any user ID). Keep this in mind for any copy of `0000` in `supabase/migrations/`
(the self-hosting plan, `.lovable/plan/vortex-own-infrastructure-2026-10-03.md` 3a item 10): it
must either skip the functions when they exist or include `0001`'s versions of them.

The guarded file has not been executed against a database in this repo (there is no local
Postgres). Before relying on it for a fresh project, run it twice on a scratch Supabase project:
the first run creates everything, the second prints the NOTICE and changes nothing.
