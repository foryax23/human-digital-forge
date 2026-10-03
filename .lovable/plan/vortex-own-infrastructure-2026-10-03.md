# Moving vortexhub.dev off Lovable: final plan (2026-10-03, reviewed and finalised 2026-10-04)

**Scope.** This plan is for Mihai Dandea, Director of Vortex Hub S.R.L. It covers moving the live site vortexhub.dev and its database, users, files and DNS out of Lovable and into accounts the company owns. The domain stays the same.

**Basis.**
- The read-only research of 2026-10-03: the code inventory, Lovable's exit docs and the target infrastructure. Then the draft runbook, an independent review on 2026-10-04, and spot-checks of the review's findings against origin/main at f395969.
- Nothing has been changed in the repo or in any account. Section 8 lists what changed after the review.

**Roles.**
- **M** is Mihai. He owns the accounts, pays, presses the buttons in Lovable, Stripe, Google and GitHub, and types every secret value himself.
- **E** is the engineer: a Claude Code session or a team engineer with repo access and member access to the new Cloudflare and Supabase accounts. E never sees a secret in chat.

---

## 0. The answer in brief (for Mihai)

1. **Yes, you can leave Lovable completely and keep vortexhub.dev.** Visitors and Google keep the same address.
2. **What moves where:**
   - The website moves to your own Cloudflare account. The app already builds for Cloudflare, and Lovable itself runs it on Cloudflare.
   - The database, user accounts and uploaded files move to your own Supabase project in Frankfurt.
   - The domain's DNS moves to Cloudflare.
   - Google login moves to your own Google client, shown as `auth.vortexhub.dev` (recommended).
   - Login emails go out through Resend.
3. **The code is already yours** on GitHub. It needs about 15 small code changes; the first draft said six. The review found three that must land before anything else:
   - a June migration that fails on a fresh database;
   - a migration that isn't safe to run twice;
   - a Stripe webhook that reports success even when saving fails.

   Every change is switched off by default, so all of them can be merged while the site still runs on Lovable.
4. **Hosting and database must move on the same evening.** Google login and the admin key only work inside Lovable, so neither can move first on its own.
5. **Cost.**
   - About **$41/month (about 195 lei)** for Cloudflare, Supabase, the domain and the `auth.vortexhub.dev` login domain. Without the login domain it is $31 (148 lei).
   - These prices are before VAT. If the company is not VAT-registered, add Romania's 21%, which it can't reclaim.
   - Today you pay Lovable Pro ($25) plus Cloud credits. Add $25 a month if you keep Lovable as an editor.
   - Anthropic usage costs the same either way.
6. **Time.**
   - Preparation runs from Monday 5 October: accounts and staging in week 1, two full rehearsals in week 2.
   - **The switch is on Thursday 15 October from 21:00.** The fallback date is Saturday 17 October.
   - The switch itself takes 2.5 to 3 hours. The site is in maintenance for about 1.5 to 2 hours of that; the exact length depends on how long Lovable takes to produce the export.
   - After the switch comes a 2-week safety window. Lovable Cloud is deleted around **Thursday 29 October**.
   - Your own time is about **13 hours over four weeks**.
7. **The risky steps, and what protects each:**
   - **The database copy.** Passwords must come across intact. We rehearse it twice, on 12 and 14 October.
   - **The evening switch.** Lovable's network might keep answering for vortexhub.dev. We test this on a throwaway subdomain on 8 October and pick the night's procedure from the result.
   - **Deleting Lovable Cloud.** This can't be undone, so we wait 2 weeks first.
8. **Going back.**
   - **Before the DNS change on the night:** nothing is lost. We turn maintenance off and unfreeze the old database.
   - **After the DNS change:** one DNS edit sends visitors back to Lovable within about 10 minutes. It takes 30 to 60+ minutes if Lovable had to be disconnected from the domain that night. Anything written on the new site in between must be copied back by hand. Decide within 24 hours.
9. **Users** keep their passwords, which the rehearsals must prove; if not, everyone gets a reset email, decided on 13 October. Everyone signs in once more. People using the AI connector (MCP) reconnect once.
10. **Lovable can stay as an editor,** syncing with GitHub. Production then goes live from GitHub through a **Deploy production** button that you approve, not through Lovable's Publish. Lovable must be told not to use its own login, AI or Cloud features. The other option is to drop Lovable after the safety window.
11. **Keep the domain registered at Lovable for now and move only its DNS.** That keeps your four portfolio subdomains working (momentumone, bridgegateaway, harvardofsales, ppdashboard). A transfer would disconnect them.
12. **Keep your Lovable plan paid until Lovable Cloud is removed.** If credits run out, the old backend pauses, and a paused backend can't be exported. It also pauses when idle; then it needs a manual **Wake up**, which is in the checklists.
13. **Other work continues**, including the 290 / 790 / 1,990 lei plans and the WhatsApp automation. Three rules apply:
    - No Lovable prompts that change the database from Monday 12 October until the switch.
    - `main` is frozen from Wednesday 14 October 22:00 to Friday 16 October evening.
    - Any checkout or plan change is tested on staging in Stripe test mode first. If the plan IDs change from `starter / growth / pro`, deep research must be told the new paid-plan names (section 2.4).

---

## 1. What Lovable does for us today, and the replacement for each

| # | Function | Today (Lovable) | Replacement | Cost after |
|---|---|---|---|---|
| 1 | Hosting: pages, server functions, /mcp, Stripe webhook | Lovable edge (185.158.133.1, on Cloudflare for SaaS) | Cloudflare Worker `vortexhub-web` on Workers Paid (Nitro preset `cloudflare-module`, which the app already uses). The apex is served by a **zone route `vortexhub.dev/*`** that one DNS edit switches on. It is not a Workers Custom Domain until day +14 (see 3e). | $5/mo |
| 2 | Build and go-live | Lovable builds; **Publish** makes it live | GitHub Actions. Every push to `main` deploys staging. **Deploy production** runs manually, only for a commit that already passed staging, and only after Mihai approves it in GitHub. | $0 |
| 3 | Preview | Lovable preview | `staging.vortexhub.dev` plus per-PR preview URLs, behind Cloudflare Access | $0 |
| 4 | Database (Postgres, row-level security, functions) | Lovable Cloud, a Supabase project we can't access (`fihhxvteymkkhvnosuyh`) | Our own Supabase project `vortexhub-prod` on Pro, eu-central-1. Its Postgres major version must be the same as Lovable's or newer. | $25/mo |
| 5 | Email and password login | Lovable Cloud Auth | Supabase Auth in the new project, with the same users and password hashes restored from the export. Settings are copied from Lovable's screens. | incl. |
| 6 | Google login | Lovable relay: `/~oauth/initiate` → `oauth.lovable.app` | Our own Google Cloud OAuth client plus `supabase.auth.signInWithOAuth`. The login domain is `auth.vortexhub.dev`. | $10/mo (login domain) |
| 7 | Auth emails (confirm, reset) | Lovable Cloud Auth emails | Supabase custom SMTP through Resend (`mail.vortexhub.dev`), with our own templates | $0 (Free tier) |
| 8 | File storage (`project-files` bucket) | Lovable Cloud Storage | Supabase Storage. Same bucket name, same access rules, files copied at the same paths. | incl. |
| 9 | Realtime (messages, projects, files, consultations, invoices) | Lovable Cloud | Supabase Realtime. The migrations already add these tables to the publication. | incl. |
| 10 | MCP OAuth (AI connector login) | Supabase OAuth server, configured by Lovable | The OAuth 2.1 server turned on in the new project, with authorization path `/.lovable/oauth/consent` and asymmetric JWT signing keys | incl. |
| 11 | Secrets (Stripe, Anthropic, Brave, Places, PageSpeed, `DEEP_*`) | Lovable secrets; write-only | Cloudflare Worker secrets, typed by M at the `wrangler` prompt, plus GitHub environment secrets for CI. Values are fetched again from each provider. | $0 |
| 12 | Applying database migrations | Lovable agent; drizzle via a hidden `LOVABLE_DB_MIGRATION_URL` | `supabase db push` from CI. Production shows a dry-run first, waits for Mihai's approval, and takes an encrypted dump before any migration. Everything lives in one folder, `supabase/migrations`. | $0 |
| 13 | DNS for vortexhub.dev | Lovable / name.com nameservers | Cloudflare DNS (Free zone). Registration stays in Lovable's workspace for now. | $0 |
| 14 | SSL certificates | Lovable | Cloudflare Universal SSL. It must show **Active** before the night. | $0 |
| 15 | Domain registration (expires 2027-06-10) | Bought through Lovable (registrar name.com) | No change for now. Optional later transfer to Cloudflare Registrar (about $12.20/yr), once the portfolio subdomains no longer depend on Lovable. | same |
| 16 | Visitor analytics (`/~flock.js`, injected) | Lovable analytics | Cloudflare Web Analytics | $0 |
| 17 | Error reporting (`window.__lovableEvents`) | Lovable runtime | Sentry Developer plan, EU region, plus Workers Logs | $0 |
| 18 | Backups | Lovable daily, about 14 days, restorable only inside Lovable | Supabase daily backups (7 days on Pro), a nightly encrypted dump to Cloudflare R2, and a weekly copy of the files bucket | $0 |
| 19 | Code editing | Lovable chat | Claude Code and the engineers. Lovable is optional (3g). | $0 or $25 |
| 20 | GitHub sync | Two-way sync on `main` | Keeps working if Lovable stays. CI deploys from GitHub either way. | $0 |

---

## 2. Prerequisites: what Mihai sets up and decides first

Pay with the company card and put the company name and VAT ID on every billing profile, so invoices are made out to the company (EU reverse charge). Ask the accountant whether the company can reclaim the VAT.

### 2.1 Accounts

| # | Account / item | What to create or do | Pays | Cost | M time |
|---|---|---|---|---|---|
| 1 | **Cloudflare** | Account on a company email, with 2FA. Add E as a member (2FA). Turn on **Workers Paid**. Add the zone `vortexhub.dev` on the Free plan. Turn on billing notifications. Accept Cloudflare's DPA. | Vortex Hub S.R.L. | $5/mo | 20 min |
| 2 | **Supabase** | Org "Vortex Hub S.R.L." on **Pro**, with project `vortexhub-prod` in eu-central-1 (Frankfurt). Its Postgres major version must be ≥ the Lovable one (2.2 e). Save the DB password in the password manager and keep the spend cap ON. Add a second **Free** org "Vortex Hub Staging" with project `vortexhub-staging`. Add E to both. Sign Supabase's DPA. Add the **custom domain add-on** to `vortexhub-prod` if decision D-1 is yes. | Vortex Hub S.R.L. | $25/mo (+$10) | 25 min |
| 3 | **Google Cloud OAuth** | Project "vortexhub-auth". **Search Console:** verify `vortexhub.dev` with a DNS TXT record, which E adds once the Cloudflare zone is active (D3). **Consent screen:** External, app name "Vortex Hub", support email, logo, privacy and terms links, authorized domains `vortexhub.dev` plus the `<prod-ref>.supabase.co` and `<staging-ref>.supabase.co` domains, as Supabase's Google guide says, scopes `openid email profile`, status **In production**. **Submit brand verification on D3**; it takes 2 to 3 business days, and without it the logo and name don't show. **Client type** Web application. Redirect URIs: `https://auth.vortexhub.dev/auth/v1/callback` (if D-1), `https://<prod-ref>.supabase.co/auth/v1/callback`, `https://<staging-ref>.supabase.co/auth/v1/callback`. JS origins: `https://vortexhub.dev`, `https://staging.vortexhub.dev`, `https://next.vortexhub.dev`, `http://localhost:5184`. M enters the client secret in Supabase himself or shares it through the password manager. | free | $0 | 40 min |
| 4 | **Stripe** (existing) | (a) Workbench → Webhooks: **confirm the live endpoint URL is exactly** `https://vortexhub.dev/api/public/stripe-webhook`, and note its events. If it points at `*.lovable.app` or a `supabase.co` URL, tell E: a new endpoint and a new `whsec` are then needed. (b) Count live subscriptions (Billing → Subscriptions, active or trialing). (c) Reveal and store the endpoint's signing secret. (d) Create a **restricted key** "vortexhub-web (Cloudflare)" with Checkout Sessions: Write, Products: Write, Prices: Write, Customers: Read. Checkout creates the price and product inline, and the webhook reads customers. (e) Create **the same restricted key in test mode**, plus a test webhook endpoint for staging. (f) **Do not roll the key Lovable uses** until day +14; it is the fallback. | existing | fees unchanged | 25 min |
| 5 | **Resend + email DNS** | Resend account (Free) after the zone is active (D3). Add domain `mail.vortexhub.dev`, region eu-west-1; E adds the DNS records in Cloudflare. API key "supabase-smtp". In Cloudflare, use **DMARC Management** so DMARC reports have a working address. Optional: Email Routing for `hello@vortexhub.dev`. Accept Resend's DPA. | free | $0 | 15 min |
| 6 | **Anthropic** | A service-account API key for the live site, in a workspace with a monthly spend limit of about 30 × `DEEP_DAILY_BUDGET_USD` ($450 at the default $15/day). It goes **only into Cloudflare**, typed at the `wrangler` prompt, **never into GitHub**: there it would silently override the WIF setup in CI. | usage | variable | 10 min |
| 7 | **Other API keys** | New keys from each provider: Brave Search (Brave dashboard), Google Places and PageSpeed (Google Cloud → Credentials, restricted to those APIs). Lovable can't show the current values. | existing | unchanged | 15 min |
| 8 | **Sentry, Better Stack** | Sentry org in the **EU** region; the region can't be changed later. Accept Sentry's DPA. Better Stack free plan for uptime checks. | free | $0 | 10 min |
| 9 | **GitHub** | Give E admin rights on `foryax23/human-digital-forge`, or add the secrets and variables yourself from E's list. Create these environments: **`production`** with required reviewer Mihai and deployment branch `main`; **`production-plan`** with no reviewer; **`staging`**. Create a dedicated Supabase access token and a Cloudflare API token for CI, using the "Edit Cloudflare Workers" template limited to the account and the `vortexhub.dev` zone. | free (public repo) | $0 | 15 min |
| 10 | **Lovable** (keep paid) | Collect the facts in 2.2 and create the 2 test accounts. | Vortex Hub S.R.L. | $25/mo until retired | 30 min |
| 11 | **Password manager and disk** | A shared vault for M and E (DB passwords, client secrets, test accounts, `DEEP_RUN_SECRET`). FileVault on the Mac that will hold the exports. | — | — | 10 min |

**All DPAs (Supabase, Cloudflare, Resend, Sentry) must be accepted before the first rehearsal on Monday 12 October.** That is the day real personal data, including password hashes, first lands in the new accounts.

**`DEEP_RUN_SECRET`.** Generate it on D1 with `openssl rand -base64 48`, store it in the password manager, and set it as a Lovable secret **at a quiet moment**. From that moment any deep-research run in progress and any report code issued before it stop validating. They would break at the move anyway, because today's key is derived from a service key only Lovable holds. Set the same value in Cloudflare later. Few such codes exist, because deep research went live on 3 October.

### 2.2 Facts M collects from Lovable on D1 (screenshots to E)

- a. **Plan and next billing date.**
- b. **Workspace settings → Workspace domains:** does vortexhub.dev show **Configure**? That confirms it was bought through Lovable. Screenshot the full DNS record list, including anything email-related.
- c. **Cloud → Secrets:** the list of names, especially every `DEEP_*` name, and whether `DEEP_RUN_SECRET` is there.
- d. **Cloud → Jobs:** confirm it is empty.
- e. **Cloud → Overview:** database and storage size (limits: 15 GB database, 5 GB export file). **Advanced settings:** the Postgres version.
- f. **Cloud → Users → Auth settings,** every screen:
  - sign-up enabled
  - email confirmation or auto-confirm
  - minimum password length and required characters
  - leaked-password protection
  - OTP and link expiry
  - secure email change
  - Google provider mode (managed or own credentials)
  - redirect URLs

  The new project copies these exactly; nothing is assumed.
- g. **Two test accounts on the live site,** one email + password and one Google, stored in the password manager.
- h. **The Stripe facts** from 2.1 row 4.

### 2.3 Decisions M makes on D1

| # | Decision | Recommendation | Why it can't wait |
|---|---|---|---|
| D-1 | Login domain `auth.vortexhub.dev` (+$10/mo) | **Yes** | Without it, Google's screen shows `<ref>.supabase.co`, which Supabase itself calls a phishing risk. Brand verification also needs a domain you own. Adding it later changes the Google callback and probably the MCP issuer, which means a second reconnect. Set up in week 1 so both rehearsals test it. |
| D-2 | Every `DEEP_*` value (2.4) | As in the table | The Worker otherwise runs on code defaults that may differ from today's Lovable values. Those values can't be read back. |
| D-3 | Switch date | **Thursday 15 October, 21:00**; fallback Saturday 17 October | A weekday means Lovable and Supabase support can be reached the next morning. It also needs at least 24 h after the last rehearsal export. |
| D-4 | Keep Lovable as editor (A) or drop it (B) | Decide on day +14 | Nothing depends on it before then. |

### 2.4 Deep-research settings to decide (D-2)

Non-secret values go into `vars` in `deploy/wrangler.production.jsonc`. Values marked *secret* are typed at `wrangler secret put`.

| Variable | Code default if unset | Proposed | Note |
|---|---|---|---|
| `DEEP_RESEARCH_MODE` | `premium` (paid plans + admins) | `admin` until the new plans are live, then `premium` | An unknown value fails closed to admin-only |
| `DEEP_RESEARCH_PREMIUM_TIERS` | `growth,pro` | the plan IDs that should include deep research | Today the plan IDs are `starter / growth / pro`. Must follow the 290 / 790 / 1,990 lei plans if they change. |
| `DEEP_ENTRY_PUBLIC` | off | off | |
| `DEEP_FREE_RUNS_PER_USER` | 1 | 1 | |
| `DEEP_USER_DAILY_RUN_CAP` / `DEEP_DAILY_RUN_CAP` | 3 / 10 | 3 / 10 | Admins: 20/day, fixed in code |
| `DEEP_RUN_BUDGET_USD` / `DEEP_DAILY_BUDGET_USD` | 1.5 (max 10) / 15 | 1.5 / 15 | Anthropic workspace limit ≈ 30 × daily |
| `DEEP_SYNTHESIS_MODEL` / `DEEP_SYNTHESIS_EFFORT` | `claude-opus-5-5` / `low` | same | |
| `DEEP_EXTRACT_MODEL` | `claude-haiku-4-5-20251001` | same | |
| `DEEP_SOURCE_COURTS` / `DEEP_SOURCE_TED` | on / on | on / on | |
| `DEEP_GOOGLE_DISPLAY` | on if a Places key is set | default | |
| `DEEP_MEMORY_LEDGER_AI` | off | off | |
| `DEEP_ASSET_ORIGIN` | unset (`https://vortexhub.dev`) | **leave unset** | The Worker reads its files through the `ASSETS` binding (3a item 4) |
| `DEEP_RESEARCH_ADMIN_EMAILS` / `_USER_IDS` *(secret)* | none | same as today | The restore keeps user IDs |
| `DEEP_RESEARCH_TEST_CODES` *(secret)* | none | the same hashes if known, otherwise new codes | Codes are stored as hashes |
| `DEEP_RUN_SECRET` *(secret)* | derived from the service key | the value generated on D1 | |

### 2.5 Ground rules for the whole migration

- **Secrets never go into chat, command arguments or shell history.**
  - M runs `supabase login` and `wrangler login` himself.
  - Values are typed at `wrangler secret put` prompts.
  - Database passwords go in with `read -rs PGPASSWORD`.
  - Database dumps never become GitHub artifacts, because the repo is public.
- **No Lovable prompt may touch the database** from Monday 12 October until the switch. Lovable's agent can change the old schema directly, as it once did with `audit_leads`.
- **`main` is frozen** from Wednesday 14 October 22:00 until E lifts it on Friday 16 October. Every Lovable Publish ships whatever `main` holds.
- **The old Stripe key, Lovable Cloud, the `_lovable*` TXT records and the domain's Lovable registration** stay untouched until day +14.

---

## 3. Runbook

### 3a. Code changes that work on any host (merge while still on Lovable)

Every change sits behind an environment flag whose default keeps today's Lovable behaviour. E opens one PR per item or a few grouped PRs. After merging, **M presses Publish in Lovable once (D2)**. That puts the maintenance switch and the webhook fix on the live Lovable deployment.

1. **Google login switch.** In `src/components/auth/GoogleButton.tsx` (keep `src/integrations/lovable/index.ts` untouched, because Lovable regenerates it):
   ```ts
   if (import.meta.env.VITE_AUTH_GOOGLE_MODE === "supabase") {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: "google",
       options: { redirectTo: `${window.location.origin}${redirectPath ?? "/dashboard"}` },
     });
     if (error) throw error;
     return; // browser goes to Google
   }
   // else: existing lovable.auth flow, unchanged
   ```
   `client.ts` creates the client without `flowType`, so it uses the implicit flow. `detectSessionInUrl` picks up `#access_token` on return, so no callback route is needed. Add `/auth/callback` only if someone switches to PKCE. The Cloudflare builds set `VITE_AUTH_GOOGLE_MODE=supabase`; Lovable never sets it.
2. **Maintenance switch, read on the server for every request.** `src/lib/maintenance.server.ts` exports `isMaintenance = () => process.env.MAINTENANCE_MODE === "1"`. When it is on:
   - The root loader shows a banner and hides the login, register, contact and checkout forms.
   - The write server functions (contact, scan lead capture, checkout, deep-research start, admin writes) return 503.
   - `/api/public/stripe-webhook` returns `503` with `Retry-After: 3600` **before** verifying the signature, so Stripe keeps the event and retries.

   It is set as a Lovable secret on the night, so no code is published then. The browser's direct writes to the database are stopped by the database freeze in 3e, not by this switch.
3. **Health endpoint.** `src/routes/api/public/health.ts` returns `{ok, supabase:"ok"|"error", supabaseHost, sha}`.
   - It checks the database with a `head`-only count on `profiles` through the service-role client.
   - `sha` comes from a `BUILD_SHA` var set at deploy time (`wrangler deploy --var BUILD_SHA:<sha>`).
   - Smoke tests, the deploy workflow and Better Stack all use it.
4. **Deep-research asset reads through the `ASSETS` binding. This is mandatory.**
   - In `src/lib/deep/env.server.ts`, wire the existing `readAsset` adapter (lines ~415, 535-540, 593-594) to `import("cloudflare:workers")` → `env.ASSETS.fetch(new URL(path, "https://assets.local"))`, inside a try/catch. Keep the HTTP fallback for Lovable.
   - With a zone route, a Worker's fetch to its own hostname goes to the placeholder origin and fails. The same happens behind Access on staging.
   - Also add `APP_HOSTS_EXTRA`, comma-separated, so `staging.vortexhub.dev` and `next.vortexhub.dev` are accepted.
   - Known limitation until the optional day +14 conversion (3g): a Vortex Scan of vortexhub.dev itself fails from the Worker.
5. **MCP forwarded-host setting.** The four generated MCP routes are:
   - `src/routes/mcp.ts`
   - `src/routes/[.well-known]/oauth-protected-resource.ts`
   - `src/routes/[.mcp]/list-tools.ts`
   - `src/routes/[.mcp]/invoke-tool/$tool.ts`

   In each, change `trustForwardedHost: true` to `process.env.MCP_TRUST_FORWARDED_HOST !== "false"`, and delete the banner line so the plugin stops regenerating the file. The Worker sets it to `"false"`, because no Lovable edge sits in front any more.
6. **MCP issuer override** (needed if D-1 is yes). In `src/lib/mcp/index.ts:14-24`, use `import.meta.env.VITE_SUPABASE_AUTH_ISSUER ?? \`https://${projectRef}.supabase.co/auth/v1\``. Supabase says Auth "will use the custom domain immediately once activated", so the token issuer may change. In rehearsal #1, E decodes a real prod session token, reads its `iss`, and sets the GitHub variable `SUPABASE_AUTH_ISSUER` to exactly that value.
7. **Sentry.** Initialise `@sentry/cloudflare` only when `SENTRY_DSN` is set. Call `Sentry.captureException` next to the existing `__lovableEvents` call in `src/lib/lovable-error-reporting.ts`.
8. **The Stripe webhook must not swallow failed writes.** In `src/routes/api/public/stripe-webhook.ts:50-55`, `upsert()` logs the error and the handler still returns 200, so Stripe never retries. Change it to `if (error) throw error;`. The existing outer `catch` then returns 500 and Stripe retries. This also improves the live Lovable site once it is published on D2.
9. **Fix the June migration that fails on a fresh project.** `supabase/migrations/20260610002123_27dd8471-….sql:21` runs `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;`. That line fails on every Supabase project, because `postgres` doesn't own `realtime.messages`, and row-level security is already on. Replace it with:
   ```sql
   DO $$ BEGIN
     IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'realtime.messages'::regclass) THEN
       ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
     END IF;
   END $$;
   ```
   Lovable Cloud applied this file in June. The Supabase CLI tracks migrations by version, so editing the file changes nothing there.
10. **Admin roles and deep ledger in the Supabase folder, rewritten so it can safely run twice.**
    - `supabase/migrations/20261003000000_admin_roles_and_deep_ledger.sql` holds the content of `drizzle/migrations/0000_admin_roles_and_deep_ledger.sql`, **made idempotent**:
      - `create type` inside `DO … EXCEPTION WHEN duplicate_object THEN NULL`
      - `create table if not exists` and `create index if not exists`
      - each `create policy` guarded by a `pg_policies` check
      - `create or replace function`
    - The original is not idempotent, and nobody has confirmed that Lovable never applies files that arrive from GitHub.
    - **Test:** apply it to the staging database twice. The second run must finish without errors, and its Q3 fingerprint (3d) for these objects must equal Lovable's.
11. **Recreate the objects that no committed migration creates.** `supabase/migrations/20261005000000_audit_leads_and_project_files_bucket.sql` holds the historical DDL from commit 7bc198d, made idempotent; its columns match `types.ts`:
    ```sql
    create table if not exists public.audit_leads (
      id uuid primary key default gen_random_uuid(),
      full_name text, email text not null, company text,
      answers jsonb not null default '{}'::jsonb, score integer not null default 0,
      recommended_tier text, recommendation text,
      language text not null default 'en', created_at timestamptz not null default now()
    );
    grant all on public.audit_leads to service_role;
    alter table public.audit_leads enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where schemaname='public' and tablename='audit_leads'
                     and policyname='No client access to audit leads') then
        create policy "No client access to audit leads" on public.audit_leads as restrictive
          for all to anon, authenticated using (false) with check (false);
      end if;
    end $$;
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('project-files', 'project-files', false, 52428800)
    on conflict (id) do nothing;
    ```
    Before cut-over, align the bucket's `file_size_limit` and `allowed_mime_types` with whatever Q3 shows on the Lovable side. Leave `drizzle/` in place until the cleanup PR. From now on, only CI runs `supabase db push`, and only against the new projects.
12. **Deploy configuration lives in `deploy/`, never at the repo root.**
    - Nitro merges any root `wrangler.json`, `wrangler.jsonc` or `wrangler.toml` into every build, **Lovable's included**. `@lovable.dev/vite-tanstack-config` then reads its `vars` while Lovable builds. A root config would push our `routes`, `vars` and `limits` into the live Lovable site.
    - So commit `deploy/wrangler.production.jsonc` and `deploy/wrangler.staging.jsonc`. CI copies the right one to `./wrangler.jsonc` immediately before `bun run build`.
    - Add `/wrangler.jsonc` to `.gitignore`.
    - Production file:
    ```jsonc
    {
      "name": "vortexhub-web",
      "compatibility_date": "2026-10-01",
      "compatibility_flags": ["nodejs_compat"],
      "workers_dev": false,
      "preview_urls": false,
      "routes": [
        // Inert while the A @ record is DNS-only (grey); it serves vortexhub.dev once that record is proxied.
        { "pattern": "vortexhub.dev/*", "zone_name": "vortexhub.dev" },
        { "pattern": "next.vortexhub.dev", "custom_domain": true }
      ],
      "limits": { "cpu_ms": 60000 },
      "observability": { "enabled": true, "head_sampling_rate": 1 },
      "upload_source_maps": true,
      "vars": {
        "NODE_ENV": "production",
        "SUPABASE_URL": "https://<prod-ref>.supabase.co",
        "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_…",
        "MCP_TRUST_FORWARDED_HOST": "false",
        "APP_HOSTS_EXTRA": "next.vortexhub.dev"
        // + the non-secret DEEP_* values decided in 2.4
      }
    }
    ```
    The staging file uses `name: "vortexhub-web-staging"`, a custom domain `staging.vortexhub.dev` and `preview_urls: true`, with staging values.
13. **CI guards**, in `scripts/ci/guards.sh`, run after every Cloudflare build:
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail
    ref="$1"
    # 1. Only the expected Supabase project is baked into the build (also catches a NEW Lovable Cloud project).
    bad=$(grep -rhoIE '[a-z0-9]{20}\.supabase\.co' .output | sort -u | grep -vx "${ref}.supabase.co" || true)
    [ -z "$bad" ] || { echo "Unexpected Supabase project(s) in build: $bad"; exit 1; }
    # 2. Apex and www are never Workers Custom Domains: in CI, Wrangler would silently take over their DNS records.
    [ "${APEX_CUSTOM_DOMAIN_ALLOWED:-false}" = true ] || jq -e '[.routes[]? | select((.custom_domain // false)
      and (.pattern == "vortexhub.dev" or .pattern == "www.vortexhub.dev"))] | length == 0' .output/server/wrangler.json >/dev/null
    # 3. No root wrangler config is tracked (it would flow into Lovable's own build).
    [ -z "$(git ls-files wrangler.json wrangler.jsonc wrangler.toml)" ]
    ```
    Lovable may rewrite `.env`, so production must never depend on `.env`. Vite gives priority to variables already set in the environment, CI sets them, and guard 1 proves it. Run the guard on staging first: if it flags legitimate strings, allow-list them explicitly.
14. **Workflows.** Action versions were checked on 2026-10-04: `actions/checkout@v7`, `oven-sh/setup-bun@v2`, `supabase/setup-cli@v3` with CLI `2.119.0`, `cloudflare/wrangler-action@v4`.
    - **`ci.yml`** (PRs and pushes): install with `--frozen-lockfile`, `tsc --noEmit`, `bun test tests`, build with staging public values, guards. ESLint stays non-blocking until one `bun run format` commit lands.
    - **`deploy-staging.yml`** (push to `main`, environment `staging`): `supabase db push` on staging, copy `deploy/wrangler.staging.jsonc`, build with the staging values, guards, then `wrangler deploy --var BUILD_SHA:$GITHUB_SHA`. PR previews run `wrangler versions upload --preview-alias pr-N` on the **staging** Worker, for same-repo PRs only. Never use `pull_request_target`.
    - **`deploy-production.yml`.** It is manual, deploys a commit that already passed staging, and waits for Mihai's approval. The jobs don't call Claude, so declaring `environment:` doesn't affect the existing WIF rule for `main`. Jobs that call Claude must never declare an environment.
      ```yaml
      name: Deploy production
      on:
        workflow_dispatch:
          inputs:
            sha: { description: "Full SHA on main that already passed Deploy staging", required: true }
      permissions: { contents: read, actions: read }
      concurrency: { group: deploy-production, cancel-in-progress: false }
      env: { SHA: "${{ inputs.sha }}" }
      jobs:
        plan:                                   # no reviewer: proves the commit and shows pending migrations
          runs-on: ubuntu-latest
          environment: production-plan
          steps:
            - uses: actions/checkout@v7
              with: { fetch-depth: 0 }
            - name: Commit is on main and passed staging
              env: { GH_TOKEN: "${{ github.token }}" }
              run: |
                [[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
                git merge-base --is-ancestor "$SHA" origin/main
                test "$(gh run list --workflow deploy-staging.yml --commit "$SHA" --status success --json databaseId --jq length)" -ge 1
                git checkout --detach "$SHA"
            - uses: oven-sh/setup-bun@v2
              with: { bun-version: 1.3.14 }   # match the team's local `bun --version`
            - run: bun install --frozen-lockfile && bunx tsc --noEmit && bun test tests
            - run: cp deploy/wrangler.production.jsonc wrangler.jsonc && bun run build
              env:
                VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}
                VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.SUPABASE_PUBLISHABLE_KEY }}
                VITE_SUPABASE_PROJECT_ID: ${{ vars.SUPABASE_PROJECT_REF }}
                VITE_SUPABASE_AUTH_ISSUER: ${{ vars.SUPABASE_AUTH_ISSUER }}
                VITE_AUTH_GOOGLE_MODE: supabase
            - run: scripts/ci/guards.sh "${{ vars.SUPABASE_PROJECT_REF }}"
            - uses: supabase/setup-cli@v3
              with: { version: 2.119.0 }
            - name: Pending migrations (the approver reads these in the run summary)
              env:
                SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
                SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
              run: |
                supabase link --project-ref "${{ vars.SUPABASE_PROJECT_REF }}"
                { echo '### Pending migrations'; echo '```'; supabase db push --dry-run; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
        deploy:
          needs: plan
          runs-on: ubuntu-latest
          environment: production               # required reviewer: Mihai
          steps:
            - uses: actions/checkout@v7
              with: { ref: "${{ inputs.sha }}" }
            - uses: oven-sh/setup-bun@v2
              with: { bun-version: 1.3.14 }
            - run: bun install --frozen-lockfile
            - run: cp deploy/wrangler.production.jsonc wrangler.jsonc && bun run build
              env:
                VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}
                VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.SUPABASE_PUBLISHABLE_KEY }}
                VITE_SUPABASE_PROJECT_ID: ${{ vars.SUPABASE_PROJECT_REF }}
                VITE_SUPABASE_AUTH_ISSUER: ${{ vars.SUPABASE_AUTH_ISSUER }}
                VITE_AUTH_GOOGLE_MODE: supabase
            - run: scripts/ci/guards.sh "${{ vars.SUPABASE_PROJECT_REF }}"
            - uses: supabase/setup-cli@v3
              with: { version: 2.119.0 }
            - name: Encrypted dump to R2 if migrations are pending, then migrate
              env:
                SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
                SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
                R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
                R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
                AGE_RECIPIENT: ${{ vars.BACKUP_AGE_RECIPIENT }}
              run: |
                supabase link --project-ref "${{ vars.SUPABASE_PROJECT_REF }}"
                if supabase db push --dry-run | grep -q '\.sql'; then scripts/ci/backup-to-r2.sh "predeploy-$SHA"; fi
                supabase db push
            - uses: cloudflare/wrangler-action@v4
              with:
                apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
                accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
                command: deploy --config .output/server/wrangler.json --var BUILD_SHA:${{ inputs.sha }}
            - run: curl -fsS "${{ vars.PROD_HEALTH_URL }}" | grep -q "$SHA"
      ```
      - `scripts/ci/backup-to-r2.sh` reuses the nightly backup logic from `target/drafts/backup.yml`: `pg_dump`, encrypt with `age`, upload to R2.
      - `PROD_HEALTH_URL` is `https://next.vortexhub.dev/api/public/health` before the switch, behind an Access bypass for that path, and `https://vortexhub.dev/api/public/health` after.
15. **`AGENTS.md`: a short "Hosting" section** for the other engineers and for Lovable's agent:
    - no wrangler config at the repo root;
    - schema changes only as new files in `supabase/migrations/`, never applied by hand;
    - don't edit `deploy/`, `.github/`, `supabase/config.toml` or `.env`.

**Done when:**
- The PRs are merged and Lovable has been published once.
- The live site behaves exactly as before.
- `MAINTENANCE_MODE` is unset in Lovable.
- The staging push of all migrations succeeds, and the second run of item 10 is clean.

### 3b. DNS to Cloudflare, staging, parked production

**1. Copy the DNS to Cloudflare (E). Nothing changes for visitors.** E reads today's records from Lovable's nameservers:
```bash
NS=ns1hwy.name.com
for n in vortexhub.dev www.vortexhub.dev momentumone.vortexhub.dev bridgegateaway.vortexhub.dev harvardofsales.vortexhub.dev ppdashboard.vortexhub.dev; do
  echo "$n A=$(dig +short A $n @$NS | tr '\n' ' ') AAAA=$(dig +short AAAA $n @$NS | tr '\n' ' ') TXT_lovable=$(dig +short TXT _lovable.$n @$NS)"
done
dig +short MX vortexhub.dev @$NS; dig +short TXT vortexhub.dev @$NS; dig +short DS vortexhub.dev @8.8.8.8   # DS empty = no DNSSEC to undo
```
The review checked this live: no hidden `_acme-challenge` or `_cf-custom-hostname` records, no wildcard, no MX or SPF, no DS record. E also compares against M's screenshot of the Lovable record list.

In the Cloudflare zone, E creates every record as **DNS only (grey cloud), TTL 60 s**:
- A 185.158.133.1 for `@`, `www`, `momentumone`, `bridgegateaway`, `harvardofsales` and `ppdashboard`;
- the six `_lovable*` TXT records, values copied exactly.

Check against Cloudflare's assigned nameservers:
```bash
CF=<name>.ns.cloudflare.com
for n in vortexhub.dev www.vortexhub.dev momentumone.vortexhub.dev bridgegateaway.vortexhub.dev harvardofsales.vortexhub.dev ppdashboard.vortexhub.dev; do
  diff <(dig +short A $n @ns1hwy.name.com) <(dig +short A $n @$CF) && echo "ok $n"; done
for n in vortexhub.dev www momentumone bridgegateaway harvardofsales ppdashboard; do
  h=_lovable.${n%.vortexhub.dev}; [ "$n" = vortexhub.dev ] && h=_lovable
  diff <(dig +short TXT $h.vortexhub.dev @ns1hwy.name.com) <(dig +short TXT $h.vortexhub.dev @$CF) && echo "ok TXT $h"; done
```

**2. Switch the nameservers (M, 5 minutes, Tuesday 6 October at 07:00, after E's OK).** Lovable → Workspace settings → Workspace domains → vortexhub.dev → **Configure → Nameservers → custom** → enter the two Cloudflare nameservers → Save.
- Lovable says it "stops managing" DNS once custom nameservers are set. If name.com stops answering at once, resolvers that cached the old delegation (TTL 10800 s) fail for **up to 3 hours**. That would hit the apex and all four portfolio sites, which is why this happens at a low-traffic hour. "Both sides serve identical records meanwhile" is an assumption, not a fact.
- E watches every 10 minutes and notes when name.com stops answering:
  ```bash
  dig +short A vortexhub.dev @ns1hwy.name.com
  dig +short NS vortexhub.dev @ns-tld1.charlestonroadregistry.com
  ```
  There is nothing to do except wait.
- The zone shows **Active** in Cloudflare within about 3 h, 24 h at most. Then check the apex and the four portfolio sites on their own.

**3. Once the zone is Active (E, D3):**
- **SSL/TLS → Edge Certificates:** Universal SSL must show **Active** for `vortexhub.dev` and `*.vortexhub.dev`. It is issued 15 minutes to 24 hours after activation, even for grey records. Every `.dev` domain is HSTS-preloaded, so a certificate gap would be a hard failure with no click-through.
- The Google **Search Console TXT record** for `vortexhub.dev`; then M submits brand verification.
- The **Resend DNS records** for `mail.vortexhub.dev`.
- **Email → DMARC Management** turned on, starting with `p=none`. It supplies a report address that works; don't point `rua` at a mailbox that doesn't exist.
- A Single Redirect rule `https://www.*` → `https://${1}`, 301, keeping the query. It only acts on proxied traffic, so it stays inert while `www` is grey.
- Optional: Email Routing for `hello@vortexhub.dev`.

**4. Supabase staging (E; M runs `supabase login`):**
```bash
brew install supabase/tap/supabase
supabase login                                 # M
supabase link --project-ref <staging-ref>      # prompts for the staging DB password
supabase db push                               # 9 June files (with the item 9 fix) + the 2 new ones
# idempotency proof for item 10/11: run both new files a second time
read -rs PGPASSWORD; export PGPASSWORD
psql "postgresql://postgres.<staging-ref>@<pooler-host>:5432/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261003000000_admin_roles_and_deep_ledger.sql \
  -f supabase/migrations/20261005000000_audit_leads_and_project_files_bucket.sql
```
Dashboard settings for staging:
- **Auth → URL configuration:** Site URL `https://staging.vortexhub.dev`; redirects `https://staging.vortexhub.dev/**` and `http://localhost:5184/**`.
- **Auth settings:** copied from Lovable's screenshots (2.2 f): confirmation, password rules, leaked-password check, expiries, secure email change.
- **Providers:** Google, with the client from 2.1.
- **SMTP:** `smtp.resend.com:465`, user `resend`, password = the Resend API key (M pastes it), sender `Vortex Hub <no-reply@mail.vortexhub.dev>`. Raise the email rate limit from 30/h to 100/h.
- **OAuth Server:** enabled, authorization path `/.lovable/oauth/consent`, dynamic client registration ON.
- **JWT signing keys:** asymmetric. If a legacy HS256 secret is in use, migrate and rotate to ECC P-256.
- **Test data:** two or three test users.

**5. Staging Worker on `staging.vortexhub.dev` (E; M types the secrets).**
- The first deploy runs from E's terminal (M runs `npx wrangler login`); after that, `deploy-staging.yml` takes over:
  ```bash
  bun install --frozen-lockfile
  cp deploy/wrangler.staging.jsonc wrangler.jsonc
  VITE_SUPABASE_URL=https://<staging-ref>.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
  VITE_SUPABASE_PROJECT_ID=<staging-ref> VITE_AUTH_GOOGLE_MODE=supabase bun run build
  scripts/ci/guards.sh <staging-ref>
  rm wrangler.jsonc
  npx wrangler deploy --config .output/server/wrangler.json --var BUILD_SHA:$(git rev-parse HEAD)
  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name vortexhub-web-staging   # M pastes at the prompt; repeat per secret
  ```
- **Secrets:** the **test-mode** restricted Stripe key and the test `whsec`; a low-limit Anthropic key or none; `DEEP_RUN_SECRET` (any value on staging).
- **Cloudflare Access** (Zero Trust Free):
  - one app for `staging.vortexhub.dev` that allows M's and E's emails;
  - separate **Bypass** apps for `staging.vortexhub.dev/api/public/stripe-webhook`, `/mcp`, `/.well-known` and `/api/public/health`. Anthropic's servers and Stripe can't pass Access.
  - Worker → Settings → Domains & Routes: turn on Access for workers.dev and Preview URLs.
- **Stripe test webhook endpoint:** `https://staging.vortexhub.dev/api/public/stripe-webhook`.

**6. Production Supabase (E):**
- `supabase link --project-ref <prod-ref> && supabase db push`.
- Settings as on staging, except:
  - Site URL `https://vortexhub.dev`;
  - redirects `https://vortexhub.dev/**` and, temporarily, `https://next.vortexhub.dev/**`;
  - email templates rewritten in Vortex Hub wording, to replace Lovable's branded emails.
- **Login domain (D-1):**
  ```bash
  supabase domains create   --project-ref <prod-ref> --custom-hostname auth.vortexhub.dev
  # Cloudflare: CNAME auth -> <prod-ref>.supabase.co (DNS only) + the _acme-challenge TXT it prints
  supabase domains reverify --project-ref <prod-ref>
  supabase domains activate --project-ref <prod-ref>
  ```
  Keep both Google redirect URIs; the project URL keeps working. Browsers and the server keep using `https://<prod-ref>.supabase.co`; Supabase advertises the login domain to Google.

**7. Production Worker, parked (E; M approves and types secrets):**
- It goes out through the **first run of `Deploy production`**, which also tests the workflow.
- The route `vortexhub.dev/*` exists but does nothing while `A @` is grey. `next.vortexhub.dev` is a Custom Domain behind Access, with a Bypass app for `/api/public/health`.
- Secrets (`npx wrangler secret put <NAME> --name vortexhub-web`, typed by M):
  - `SUPABASE_SERVICE_ROLE_KEY` (prod `sb_secret_…`)
  - `STRIPE_SECRET_KEY` (the new live restricted key)
  - `STRIPE_WEBHOOK_SECRET` (the live endpoint's `whsec`)
  - `ANTHROPIC_API_KEY`
  - `DEEP_RUN_SECRET`, `DEEP_RESEARCH_TEST_CODES`, `DEEP_RESEARCH_ADMIN_EMAILS`, `DEEP_RESEARCH_ADMIN_USER_IDS`
  - `BRAVE_SEARCH_API_KEY`, `GOOGLE_PLACES_API_KEY`, `PAGESPEED_API_KEY`
  - `SENTRY_DSN`
- Check with `npx wrangler secret list --name vortexhub-web`, then `curl -s https://next.vortexhub.dev/api/public/health`.

**8. Staging click-through (M, 45 to 60 minutes, Friday 9 October)** on `staging.vortexhub.dev`:
- register, open the confirmation email, log in, log out
- request a password reset email
- Google login
- dashboard: create a project, send a message and watch it arrive live in a second tab
- upload a file and download it
- contact form
- Vortex Scan on a real company
- one deep-research run as admin
- checkout with card `4242 4242 4242 4242`, using the **test restricted key**: the `subscribers` row appears and `status` is right
- `/.well-known/oauth-protected-resource` shows the staging issuer
- connect an MCP client to `https://staging.vortexhub.dev/mcp` and approve on the consent page

E watches Workers Logs for CPU time and memory during the scan and the deep run.

### 3c. Test: does Lovable let go of a hostname? (D4, Thursday 8 October)

185.158.133.1 belongs to Cloudflare (AS13335), so Lovable runs on Cloudflare for SaaS. For an exact hostname match, Cloudflare ranks a SaaS custom hostname **above** a record in the customer's own zone. While vortexhub.dev is still connected to the Lovable project, Lovable might keep answering after our DNS flip. We find out on a throwaway name first:

1. **M:** create a blank Lovable project "lovtest", publish it, and **connect `lovtest.vortexhub.dev`**. E adds the A and `_lovable.lovtest` TXT records that Lovable shows, DNS only. Wait until Lovable shows **Live**.
2. **E:** add a route `lovtest.vortexhub.dev/*` (zone vortexhub.dev) to the **staging** Worker in the dashboard: Workers → vortexhub-web-staging → Settings → Domains & Routes → Add → Route. Don't push to `main` during the test, because a staging deploy may reset the routes.
3. **E:** edit `A lovtest` from 185.158.133.1 (DNS only) to `192.0.2.1` **Proxied** in **one save**. After 2 minutes:
   ```bash
   curl -sI https://lovtest.vortexhub.dev | grep -iE '^(server|x-deployment-id)'
   curl -s https://lovtest.vortexhub.dev | grep -c '~flock.js'
   ```
   - No `x-deployment-id` and `0` → **the Worker answers.** Outcome 1.
   - `x-deployment-id: …` or `1` → **Lovable still answers.** Outcome 2.
4. **Rollback drill:** reverse the edit in one save, then time how long until Lovable answers again.
5. **Only for outcome 2:**
   - M disconnects `lovtest.vortexhub.dev` in the Lovable project. Check that the Worker now answers.
   - M reconnects it. Time how long until Lovable is **Live** again; that is the rollback cost.
6. Clean up: remove the route, the records and the lovtest project.

**Result → procedure on the night:**
- **Outcome 1:** the flip alone moves traffic, and rollback is the reverse flip (about 10 minutes).
- **Outcome 2:** the flip **plus** M disconnecting `vortexhub.dev` and `www` from the Lovable project at +50. Rollback then also needs a reconnect (the time measured in step 5, typically 30 to 60+ minutes).

### 3d. Data migration rehearsals (two)

| | Rehearsal #1 | Rehearsal #2 |
|---|---|---|
| Date | Monday 12 October | Wednesday 14 October |
| Export requested | 10:00 | 10:00 (48 h after #1, 35 h before the switch's export) |
| Target | `vortexhub-prod` (nobody uses it yet, so the real configuration is tested too) | `vortexhub-prod`, wiped first (wipe in 3e) |
| Evening | 22:00 maintenance-timing test (5 min) | 22:00 full freeze drill (20 min); `main` freezes afterwards |

Lovable allows one export every 24 hours. The old backend must be awake: in Cloud → Overview, press **Wake up** if it is paused.

**1. Export (M).** Lovable → More → Cloud → Overview → Advanced settings → Export project data → Database → Export → Start export. Write down the time requested and the time the email arrives; **that gap sets the length of the freeze on the night.** Download the file onto the FileVault disk.

**2. Files (M).** Cloud → Storage → `project-files` → select all → Download, which gives a zip. Record the number of files and the total size.

**3. Old-side baseline (M in Lovable → Cloud → SQL editor; E runs the same on the new side).**
```sql
-- (Q0) server version: the new project must be the same major or newer
show server_version;

-- (Q1) exact row counts, all public tables
select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint as row_count
from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1;

-- (Q2) users, identities, files
select 'auth.users' k, count(*) from auth.users
union all select 'auth.identities', count(*) from auth.identities
union all select 'identities google', count(*) from auth.identities where provider='google'
union all select 'users bcrypt pw', count(*) from auth.users where encrypted_password like '$2%'
union all select 'users confirmed', count(*) from auth.users where email_confirmed_at is not null
union all select 'files project-files', count(*) from storage.objects where bucket_id='project-files'
union all select 'admins', count(*) from public.user_roles where role='admin';

-- (Q3) schema fingerprint: run on both sides and diff (freeze_* policies are ignored)
select 'table' k, table_name o, '' d from information_schema.tables where table_schema='public'
union all select 'column', table_name||'.'||column_name, data_type||' '||is_nullable||' '||coalesce(column_default,'') from information_schema.columns where table_schema='public'
union all select 'auth-column', table_name||'.'||column_name, data_type||' '||is_nullable from information_schema.columns where table_schema='auth' and table_name in ('users','identities','mfa_factors')
union all select 'policy', schemaname||'.'||tablename||'.'||policyname, cmd from pg_policies where schemaname in ('public','storage','realtime') and policyname not like 'freeze\_%'
union all select 'function', p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'trigger', event_object_schema||'.'||event_object_table||'.'||trigger_name, action_timing||' '||event_manipulation from information_schema.triggers where event_object_schema in ('public','auth')
union all select 'realtime', tablename, pubname from pg_publication_tables where pubname='supabase_realtime'
union all select 'bucket', id, public::text||' '||coalesce(file_size_limit::text,'-')||' '||coalesce(array_to_string(allowed_mime_types, ','),'-') from storage.buckets
union all select 'enum', t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname
union all select 'extension', extname, extversion from pg_extension
order by 1,2;
```
How to read the Q3 diff:
- Any object on the old side that is missing on the new side means E writes a new migration before the next run, as with `audit_leads`.
- Extra `auth-column` rows on the new side are fine, because the newer Auth version adds columns. Old-only `auth-column` rows block the restore.
- Extension versions are for information only.

**4. Restore (E, on the Mac).**
```bash
brew install postgresql@18 rclone
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"
pg_config --configure | grep -o with-zstd       # must print with-zstd (Homebrew libpq reportedly lacks it)
EXPORT=~/vortex-migration/lovable-<date>.backup # unzip first if it came as .zip; FileVault disk
export PGHOST='<session-pooler-host>' PGPORT=5432 PGDATABASE=postgres PGUSER='postgres.<prod-ref>' PGSSLMODE=require
read -rs PGPASSWORD; export PGPASSWORD          # Supabase → Connect → Session pooler (IPv4); never on the command line

pg_restore --list "$EXPORT" > toc.full.txt
grep -E 'TABLE DATA (cron|net|vault|supabase_functions) ' toc.full.txt     # expect nothing that matters
grep -E '^[0-9]+; [0-9]+ [0-9]+ TABLE DATA public '                            toc.full.txt >  data.list
grep -E '^[0-9]+; [0-9]+ [0-9]+ TABLE DATA auth (users|identities|mfa_factors) ' toc.full.txt >> data.list
grep -E '^[0-9]+; [0-9]+ [0-9]+ SEQUENCE SET public '                          toc.full.txt >> data.list
cat data.list    # expect exactly the public tables listed by Q1; anything else = investigate

pg_restore --data-only --no-owner --no-privileges --use-list=data.list -f data.sql "$EXPORT"   # proves zstd works
sed -i '' '/^SET transaction_timeout/d' data.sql   # pg_restore 18 emits it; servers older than 17 reject it
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file data.sql
psql -c 'VACUUM ANALYZE;'
```
Why it is done this way:
- The schema comes from our migrations, which keeps the migration history clean; only data comes from the export.
- `replica` mode stops the `on_auth_user_created` trigger from creating duplicate `profiles` rows. The trigger-based foreign-key checks are skipped too, which is why the orphan checks below matter.
- What is deliberately skipped:
  - `auth.sessions`, `refresh_tokens`, `flow_state`, `one_time_tokens`, `audit_log_entries` and `auth.schema_migrations`: sessions can't carry over anyway.
  - `auth.oauth_*`: MCP clients register again.
  - `storage.*`: files are copied as real objects in step 5.
  - `supabase_migrations` and `drizzle`.
- `--single-transaction` means a failure leaves the database untouched. Fix the cause and rerun.

**5. Copy the files.**
```bash
unzip lovable-project-files.zip -d storage-export/project-files
find storage-export/project-files -type f | head      # paths must look like <user-uuid>/<file>; else rebuild paths from
#   select name from storage.objects where bucket_id='project-files';   (Lovable SQL editor)
# Supabase prod → Storage → S3 Configuration → New access key (a fresh key per run; revoke it afterwards)
export RCLONE_CONFIG_SBPROD_TYPE=s3 RCLONE_CONFIG_SBPROD_PROVIDER=Other \
       RCLONE_CONFIG_SBPROD_ENDPOINT='<endpoint shown on that page>' RCLONE_CONFIG_SBPROD_REGION='<region shown>'
read -r RCLONE_CONFIG_SBPROD_ACCESS_KEY_ID; read -rs RCLONE_CONFIG_SBPROD_SECRET_ACCESS_KEY
export RCLONE_CONFIG_SBPROD_ACCESS_KEY_ID RCLONE_CONFIG_SBPROD_SECRET_ACCESS_KEY
rclone sync  storage-export/project-files sbprod:project-files --progress
rclone check storage-export/project-files sbprod:project-files --size-only
```
The storage rules check `(storage.foldername(name))[1] = auth.uid()`, not the object owner, so keeping the paths keeps access working.

**6. Checks on the new side. All must pass.**
```sql
-- Q1 and Q2 equal to the old side
-- every user kept its login methods (the identities trap):
select count(*) from auth.users u where not exists (select 1 from auth.identities i where i.user_id=u.id);   -- 0
-- password hashes usable (bcrypt):
select count(*) filter (where encrypted_password like '$2%') bcrypt,
       count(*) filter (where coalesce(encrypted_password,'')='') no_pw, count(*) from auth.users;          -- same as old
-- no orphans (FK triggers were off during load):
select count(*) from public.profiles p left join auth.users u on u.id=p.id where u.id is null;               -- 0
select count(*) from public.user_roles r left join auth.users u on u.id=r.user_id where u.id is null;        -- 0
-- every file the app points at exists:
select count(*) from public.project_files pf where pf.file_path is not null and not exists
  (select 1 from storage.objects o where o.bucket_id='project-files' and o.name=pf.file_path);               -- 0
-- row-level security is on for every public table:
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;                                          -- no rows
-- owner is still admin:
select u.email from public.user_roles r join auth.users u on u.id=r.user_id where r.role='admin';            -- the owner's email
```
Then run Supabase → Advisors → Security Advisor and expect no new errors.

**7. M tests in the app** on `https://next.vortexhub.dev` (behind Access, production configuration, rehearsal data):
- Log in with the email test account **using the old password**.
- Log in with the Google test account, then with your own Google account. Each must land on the *existing* account with its data, not a new empty one.
- The admin panel is visible.
- Dashboard data, messages and invoices look right.
- Open an old uploaded file.
- `/.well-known/oauth-protected-resource` shows the prod issuer.

**Rehearsal #1 only:**
- E copies the `access_token` from the browser's `sb-…-auth-token` storage entry and decodes its payload locally:
  ```bash
  read -rs TOKEN
  python3 -c 'import sys,base64,json;p=sys.argv[1].split(".")[1];print(json.loads(base64.urlsafe_b64decode(p+"="*(-len(p)%4)))["iss"])' "$TOKEN"
  ```
  Set the GitHub variable `SUPABASE_AUTH_ISSUER` to its `iss`, then redeploy production.
- **If old passwords don't work,** the export's hashes aren't usable, which two third-party guides report. The fallback is a bulk password-reset email plus a banner after the switch. M decides on Tuesday 13 October, not on the night.

**8. Evening tests on the live old site.**
- **Rehearsal #1, 22:00, about 5 minutes: maintenance timing.**
  1. M sets the Lovable secret `MAINTENANCE_MODE=1`.
  2. Measure how long until the banner appears on vortexhub.dev. If nothing changes within 2 minutes, press Publish; `main` holds tested code.
  3. Check that `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://vortexhub.dev/api/public/stripe-webhook` returns `503`.
  4. Delete the secret, or set it to 0, and confirm the site is normal again.
- **Rehearsal #2, 22:00, about 20 minutes: full freeze drill.** Use the FREEZE and UNFREEZE scripts from 3e.
  1. Set maintenance on.
  2. Run the freeze SQL and set **Disable sign-up** in Auth settings.
  3. M, logged in on the old site, tries to send a dashboard message and upload a file. **Both must fail.**
  4. Run the unfreeze SQL and turn sign-up back on. Both actions must now work.
  5. Turn maintenance off.

**9. Write down the timings:** export wait, restore, file copy, checks. The night's freeze length ≈ export wait + about 75 minutes.

**10. Afterwards (C6):** delete the local export and zip once the rehearsal is done. Revoke the rclone S3 key.

### 3e. Cut-over night (Thursday 15 October, T = 21:00 Romanian time)

**Go/no-go at 10:00 the same day (E and M). All of these must be true:**
- The staging click-through passed.
- Both rehearsals passed: every check is 0 or equal, and old passwords work or the reset fallback is ready.
- The freeze drill passed.
- The 3c result is known and the night's procedure is chosen (flip only, or flip plus disconnect).
- The zone is **Active**, and Universal SSL is **Active** for `vortexhub.dev` and `*.vortexhub.dev`.
- The production Worker runs the commit that passed staging, the route `vortexhub.dev/*` exists, and `wrangler secret list` is complete. `https://next.vortexhub.dev/api/public/health` shows the prod host and that commit.
- `main` has been frozen since Wednesday 22:00, and there have been no Lovable database prompts since Monday 12 October.
- The DPAs are accepted, the Stripe facts are confirmed, and MCP users have been told to reconnect.
- M is available 20:45 to 24:00 with Lovable, Stripe, Google, Cloudflare, Supabase and GitHub open. E has the commands typed out in advance.

**FREEZE (old database, Lovable SQL editor):**
```sql
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('create policy freeze_insert on public.%I as restrictive for insert to anon, authenticated with check (false)', t.tablename);
    execute format('create policy freeze_update on public.%I as restrictive for update to anon, authenticated using (false)', t.tablename);
    execute format('create policy freeze_delete on public.%I as restrictive for delete to anon, authenticated using (false)', t.tablename);
  end loop;
end $$;
create policy freeze_insert on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'project-files');
create policy freeze_update on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'project-files');
create policy freeze_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'project-files');
-- check: 3 × (number of public tables) and 3
select count(*) filter (where schemaname='public') public_freeze, count(*) filter (where schemaname='storage') storage_freeze
from pg_policies where policyname like 'freeze\_%';
```
Also: Lovable → Cloud → Users → Auth settings → **Disable sign-up**.

Why it is needed: browsers write straight to the old database, for sign-ups, messages, projects and uploads. Open dashboard tabs, the `lovable.app` copy and stale DNS keep doing so even after the switch. Server-side writes are already stopped by `MAINTENANCE_MODE`. With the freeze in place, old and new counts must match exactly.

**UNFREEZE (rollback only):**
```sql
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
           where policyname in ('freeze_insert','freeze_update','freeze_delete') and schemaname in ('public','storage') loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;
```
Then turn sign-up back on.

**WIPE the rehearsal data (new side, T-60):**
```bash
rclone delete sbprod:project-files      # delete files through the Storage API, not SQL
```
```sql
do $$ declare l text; begin
  select string_agg(format('public.%I', tablename), ', ') into l from pg_tables where schemaname = 'public';
  execute 'truncate table ' || l || ' restart identity cascade';
end $$;
delete from auth.users;   -- cascades to identities, sessions, MFA factors
```

**Timetable:**

| Time | Who | Step | Check |
|---|---|---|---|
| T-60 | E | WIPE (above) | Q1 all zeros; 0 objects in `project-files` |
| T-15 | M | Lovable → Cloud → Overview: the backend is awake (**Wake up** if paused) | — |
| T+0 | M | Lovable → Cloud → Secrets: add `MAINTENANCE_MODE=1`. Publish only if the 3d timing showed it is needed; `main` is frozen, so Publish ships the tested commit. | Banner on vortexhub.dev and on the lovable.app URL; webhook POST returns 503 |
| T+3 | M | FREEZE SQL; **Disable sign-up** | Policy counts right; sending a dashboard message fails |
| T+8 | M | Run Q1, Q2 and Q3 in the SQL editor and save them as CSV. Request the **final export**. Download the storage zip. | Old baseline saved |
| T+8…T+x | E | Wait for the export email (time measured in the rehearsals). Meanwhile, `rclone sync` the zip, and diff the night's Q3 against rehearsal #2's. | Q3 unchanged, or a stop decision |
| T+x | E | Restore script (3d step 4) | psql exits 0 |
| +15 | E | Checks (3d step 6); compare Q1 and Q2 with the T+8 baseline | All equal; all checks 0 |
| +30 | M | App test on `next.vortexhub.dev` as in 3d step 7, plus: upload a new file, submit a contact form (delete the test rows afterwards), run one scan | All OK |
| +45 | M+E | **Go/no-go #2. Going back here loses nothing:** UNFREEZE, enable sign-up, delete `MAINTENANCE_MODE`. | — |
| +50 | E | Cloudflare DNS: edit **`A @`** from `185.158.133.1` DNS only to **`192.0.2.1` Proxied, in one save**. Then the same for **`A www`**; the redirect rule already exists. Nothing is deleted, so there is no gap that resolvers could cache. **Outcome 2 only:** M disconnects `vortexhub.dev` and `www` in the Lovable project's domain settings. | `dig +short vortexhub.dev @1.1.1.1` shows Cloudflare proxy addresses, not 185.158.133.1 |
| +55 | E | Smoke tests (below), after flushing the local DNS cache. **If Lovable still answers after 10 minutes in outcome 1, M disconnects the domain in Lovable now** (the outcome 2 procedure). | All pass |
| +60 | M+E | Stripe Workbench → Webhooks → endpoint → **Event deliveries**: **Resend** each event that failed with 503 during the freeze, **oldest first** (the upsert by email means the last write wins). After each one, E checks the `subscribers` row itself; a 200 alone proves nothing. | No failed deliveries left; rows correct |
| +65 | M | Real tests on `https://vortexhub.dev`: Google login to an existing account, password login, password-reset email arrives, admin panel. Reconnect Claude or another MCP client to `https://vortexhub.dev/mcp`. | All OK |
| +75 | E | Reconcile Stripe: compare Stripe's active subscriptions (Dashboard export, or the Stripe CLI with a read-only key) with `select email, stripe_subscription_id, status from subscribers`. Skip if there are no live subscriptions. Set `PROD_HEALTH_URL=https://vortexhub.dev/api/public/health`. Turn on the Better Stack monitors. | Match |
| +80 | M+E | **Open.** Leave Lovable frozen (maintenance + database freeze + sign-up disabled) as the fallback copy. Watch Sentry and Workers Logs for 30 minutes. | — |

**Smoke tests (+55):**
```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
curl -sI https://vortexhub.dev | grep -iE '^(HTTP|server|x-deployment-id)'   # HTTP/2 200, server: cloudflare, and NO x-deployment-id
curl -s https://vortexhub.dev | grep -c '~flock.js'                          # 0 = no longer served by Lovable
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.vortexhub.dev/pricing   # 301 https://vortexhub.dev/pricing
curl -s https://vortexhub.dev/api/public/health                              # ok:true, supabase:"ok", prod host, the deployed sha
curl -s https://vortexhub.dev/.well-known/oauth-protected-resource | grep -oE 'https://[a-z0-9.-]+/auth/v1'   # the prod issuer
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://vortexhub.dev/api/public/stripe-webhook          # 400 (missing signature); 500 = Stripe secrets missing
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://vortexhub.dev/~oauth/initiate            # anything except a 302 to oauth.lovable.app
for s in momentumone bridgegateaway harvardofsales ppdashboard; do curl -s -o /dev/null -w "$s %{http_code}\n" https://$s.vortexhub.dev; done   # 200 each (still Lovable)
```
Then, in a browser: a deep link such as `/dashboard/files` loads directly, and the login, register, contact and pricing pages render with no console errors.

**The next day:** remove `https://next.vortexhub.dev/**` from the Supabase prod redirect list. Google needs no change on the night. Stripe needs no URL change: the same endpoint and the same `whsec`, now answered by the Worker.

### 3f. Rollback plan

| When | How to go back | Time | What is lost |
|---|---|---|---|
| Before go/no-go #2 (+45) | UNFREEZE, enable sign-up, delete `MAINTENANCE_MODE` | 5 min | Nothing |
| After the DNS flip (decide by +24 h at the latest) | (1) Lovable: **Wake up** Cloud if it paused while idle. (2) Cloudflare DNS: `A @` back to `185.158.133.1`, **DNS only**, one save; the same for `A www`. (3) **Outcome 2 only:** reconnect `vortexhub.dev` and `www` in the Lovable project and wait for **Live**. (4) Lovable: UNFREEZE, enable sign-up, delete `MAINTENANCE_MODE`, Publish if needed. (5) Check that `/~oauth/initiate` returns 302 to oauth.lovable.app and that `x-deployment-id` is back. (6) Stripe: **Resend** the events the Worker received after the flip, oldest first; Lovable answers them now. (7) Copy the data back (below). | About 10 min, plus up to 5 min for resolvers that still hold the proxied address. **30 to 60+ min** with step 3 (time measured in 3c). | Rows written on the new site after the flip |
| After Lovable Cloud is removed (day +14) | No way back to Lovable. Fix forward: restore from Supabase backups or from the R2 dumps. | — | — |

**Copying data back by hand (second row only).** On the new database, list what changed after the flip time `T1`:
```sql
select 'profiles' t, count(*) from public.profiles where created_at > 'T1' union all
select 'projects', count(*) from public.projects where created_at > 'T1' union all
select 'messages', count(*) from public.messages where created_at > 'T1' union all
select 'contact_enquiries', count(*) from public.contact_enquiries where created_at > 'T1' union all
select 'consultations', count(*) from public.consultations where created_at > 'T1' union all
select 'audit_leads', count(*) from public.audit_leads where created_at > 'T1' union all
select 'subscribers', count(*) from public.subscribers where created_at > 'T1' union all
select 'auth.users', count(*) from auth.users where created_at > 'T1';
```
- Export those rows as `INSERT`s and paste them into Lovable's SQL editor, which asks for confirmation on writes.
- Users who signed up on the new site must sign up again on the old one; email them.
- Files uploaded after `T1`: download them from the new bucket and upload them in Lovable → Storage.

**Until day +14, do not:**
- remove or pause Lovable Cloud, or let the plan or its credits run out
- drop the freeze on the old database, except to roll back
- roll or delete the Stripe key Lovable uses, or the other API keys Lovable holds
- transfer the domain, remove it from the workspace, or change the `_lovable*` TXT records
- disconnect the domain from the Lovable project, unless 3c or the night required it

### 3g. After cut-over

**Day +1 (Friday 16 October, E):**
- Remove `next.vortexhub.dev` from the Supabase redirect list. Keep Access on it, or delete that hostname.
- Turn on Cloudflare Web Analytics.
- Privacy PR in `src/routes/privacy.tsx`: update the processors (Cloudflare, Supabase Frankfurt, Resend, Sentry EU; Lovable stays listed until day +14). Change `<meta name="author">` in `src/routes/__root.tsx:91` to "Vortex Hub S.R.L.".
- Turn on the nightly encrypted R2 backup workflow (`target/drafts/backup.yml`) and the weekly `rclone sync` of `project-files` to R2.
- Store the final Lovable export and storage zip **encrypted** in R2 `archive/`, kept for 12 months. Then **delete the local copies** and **revoke the rclone S3 key**.
- In the evening, if everything is stable, **lift the `main` freeze**.

**Day +1 to +14: safety window.** Watch Stripe deliveries, sign-in errors (Supabase → Auth logs), Sentry and Better Stack. Run Q1 weekly.

**Day +14 (Thursday 29 October; Saturday 31 October if the fallback date was used): retire Lovable Cloud (M, about 45 minutes):**
1. Final check: no rollback is needed, and the archive is readable. E runs `pg_restore --list` on it, or restores it into a scratch project.
2. Lovable → More → Cloud → Overview → Advanced settings → **Remove Cloud**: tick both boxes and type the project name. **This can't be undone.**
3. Unpublish the `human-digital-forge.lovable.app` copy.
4. If not already done, disconnect `vortexhub.dev` and `www` from the project. **Do not remove the domain from the workspace:** the registration and its renewal stay there, and the nameservers stay on Cloudflare.
5. **Revoke the credentials Lovable held:** the old Stripe secret key, and the Anthropic, Brave, Places and PageSpeed keys it used. Remove "Lovable hosts the site" from the privacy page.
6. Optional: turn the apex into a **Workers Custom Domain**. This makes a Vortex Scan of vortexhub.dev itself work, and gives an Advanced certificate. In `deploy/wrangler.production.jsonc`, replace the route with `{ "pattern": "vortexhub.dev", "custom_domain": true }`. Set the GitHub variable `APEX_CUSTOM_DOMAIN_ALLOWED=true`. Then deploy once from a terminal and confirm Wrangler's offer to update the existing record.

**Keep Lovable as an editor, or drop it? M decides on day +14 (D-4).**

*Option A, keep it (Pro, $25/mo):*
- GitHub sync continues. Lovable commits land on `main`; CI checks them and deploys staging. Production goes live only through **Deploy production**: you approve it after reading the pending migrations in the run summary.
- Do **not** connect any Supabase project to Lovable. Lovable stays a code editor only, and nothing applies migrations except CI.
- Commit `.env` with the **staging** public values, so Lovable's preview talks to staging and never to production. Production never reads `.env`; guard 1 proves it, and it also catches a new Lovable Cloud project that the editor might create on its own.
- Paste this into Lovable → Project knowledge (it matches `AGENTS.md`):
  > "The backend is an external Supabase project managed outside Lovable. Never enable Lovable Cloud, lovable.auth, the Lovable AI gateway or connectors. Do not edit `.env`, `supabase/config.toml`, `deploy/`, `.github/`, and never create a wrangler config at the repo root. Schema changes go only into a new file in `supabase/migrations/`; never run migrations. Google login uses `supabase.auth.signInWithOAuth`."
- Leave `main` unprotected; a protected `main` makes Lovable push to a `lovable-sync` branch instead. Never force-push or rebase `main`.

*Option B, drop it:*
- Downgrade to Free. It takes effect at the end of the billing period.
- Disconnect Git sync (Lovable → GitHub → Disconnect) and **uninstall the Lovable GitHub App**. The repo is not affected.
- Then protect `main`: require the CI check and PRs.
- The domain keeps renewing through the Lovable workspace on 2027-06-10, so keep a card there. Transfer it to Cloudflare Registrar only once the four portfolio subdomains no longer depend on Lovable. A transfer disconnects Lovable projects, and reconnecting custom domains needs a paid plan.

**Cleanup PR (E, after day +14):**
- Remove `@lovable.dev/cloud-auth-js`, `src/integrations/lovable/`, the Lovable branch in `GoogleButton`, `previewAuthStorage.ts` and `lovable-error-reporting.ts`.
- Remove the `human-digital-forge.lovable.app` entry from `APP_HOSTS`, and the HTTP asset fallback.
- Remove `drizzle.config.ts`, `drizzle/` and the drizzle packages; `supabase/migrations` is the only track. Set `supabase/config.toml` `project_id` to the prod ref.
- Remove the `bunfig.toml` exceptions for Lovable packages. Later, replace `@lovable.dev/vite-tanstack-config` with plain Vite plugins.
- Also, separately:
  - tighten the `realtime.messages` policies, which are `USING (true)` today;
  - make one `bun run format` commit and make ESLint blocking;
  - fix `current_period_end`, which on current Stripe API versions lives on the subscription items, in `src/routes/api/public/stripe-webhook.ts:100-102`.

---

## 4. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | Password hashes in the export are not usable (two third-party guides say so; Lovable's docs say they are) | Medium / high | Tested with the test account in both rehearsals. The fallback (bulk reset email plus banner) is decided on Tuesday 13 October. |
| 2 | Google users land on a new empty account | Low / high | The restored `auth.identities` keep Google's `sub`, which is the same across OAuth clients, and Supabase links identities with the same verified email. Tested with 2 real Google accounts. |
| 3 | Lovable keeps serving vortexhub.dev after the flip (Cloudflare for SaaS hostname priority) | Medium / medium | Tested on `lovtest` in 3c. `x-deployment-id` smoke test. The contingency is disconnecting the domain in Lovable, which makes rollback 30 to 60+ minutes. Failure is safe: visitors would only see the frozen old site. |
| 4 | Visitors cached "no address" during the switch or a rollback (Cloudflare caches negative answers up to 30 minutes) | Removed | Single-save record edits instead of delete-then-add; a zone route instead of a Custom Domain; CI guard 2 stops Wrangler from silently taking over apex DNS. |
| 5 | name.com stops answering right after the nameserver change, so apex and portfolio sites fail for some visitors for up to 3 h | Low-medium / medium | Switched at 07:00 on a Tuesday, more than a week before the night; watched with `dig`. |
| 6 | Certificate gap on a `.dev` domain (HSTS preload, no click-through) | Low / high | Universal SSL **Active** is a go/no-go item. |
| 7 | Writes slip through the freeze (open tabs, the lovable.app copy, stale DNS) and are lost | Medium / high without the database freeze | Database-level freeze plus sign-up disabled at T+3, drilled on 14 October; the T+8 baseline must equal the restore. |
| 8 | Stripe events lost silently | Medium / medium | The webhook now returns 500 on a failed write (3a item 8). Resend oldest first, check rows directly, reconcile against Stripe's list. Stripe retries for 3 days in live mode; Resend works for 15 days. |
| 9 | Stripe endpoint not on vortexhub.dev, or the restricted key lacks permissions | Low / medium | Confirmed on D1. The identical restricted key in test mode is used on staging before the live one is used. |
| 10 | `supabase db push` fails on a fresh project | Certain without the fix | 3a item 9; proven on staging on D2. |
| 11 | A root wrangler config leaks into Lovable's live build | Medium / high | Configs live in `deploy/`; CI guard 3; `.gitignore`; `AGENTS.md`. |
| 12 | Lovable applies the new migration files to its own database | Unknown / medium | Rewritten to be idempotent, and proven by running them twice (3a item 10). |
| 13 | The old schema changes between the rehearsals and the night | Low / medium | No Lovable database prompts from 12 October; Q3 diff at T+8. |
| 14 | Postgres major version mismatch (`SET transaction_timeout` needs 17+) | Low / medium | Q0 on D1 and in the rehearsals; the `sed` strip in the restore script. |
| 15 | The export takes long, or the one-per-24 h limit collides with the schedule | Medium / medium | Exports scheduled at 10:00 Mon and Wed, the night's at Thu 21:08 (more than 24 h apart). The wait is measured twice. Limits: 15 GB database, 5 GB file. |
| 16 | Lovable Cloud pauses: credits run out (can't export) or idle (needs Wake up) | Low / high | Keep Pro and top up if needed. **Wake up** is a step before each export and in the rollback. |
| 17 | Lovable regenerates files, reverts `.env` or brings back `lovable.auth` | Medium / medium | Flags live in files Lovable doesn't own; production ignores `.env`; CI guard 1 checks that only the expected Supabase project is in the build; Project knowledge and `AGENTS.md`; production deploys need approval. |
| 18 | A bad or untested commit reaches production (several engineers plus Lovable on `main`) | Medium / high | Only a commit that passed staging can be deployed; dry-run of migrations; Mihai's approval; encrypted dump before migrations; `main` frozen around the night. |
| 19 | Worker CPU or memory limits during a scan or deep research (128 MB, 1 s startup) | Low / medium | Workers Paid with `limits.cpu_ms` 60000; measured on staging; Workers Logs. |
| 20 | Deep research or the scan fetching the site's own domain fails | Certain without the fix / low | `ASSETS` binding (3a item 4). Scanning vortexhub.dev itself waits for the optional day +14 conversion. |
| 21 | Old report verification codes stop working | Certain for codes issued before `DEEP_RUN_SECRET` / low | `DEEP_RUN_SECRET` set on D1 and reused. Very few codes exist. |
| 22 | The Worker runs with different `DEEP_*` values than today | Medium / medium | Every value decided explicitly (2.4). |
| 23 | MCP clients break (new issuer), or MCP can't pass Access on staging | Certain / low | Users told in advance and reconnect on the night. Access Bypass apps for `/mcp` and `/.well-known`. Issuer read from a real token. The OAuth server is in beta; the route path is kept. |
| 24 | Secrets leak (public repo, public CI logs, chat) | Low / high | Values only at prompts; Cloudflare and GitHub environments only; `ANTHROPIC_API_KEY` never in GitHub; no dumps as GitHub artifacts. M checks that the tracked `.env` holds only public `VITE_*` values, and checks the scanner hit in `public/scan-index/v1/t/45.txt`. |
| 25 | Personal data processed before the paperwork exists | Certain without the change / medium | DPAs accepted before 12 October; FileVault; local copies deleted; S3 keys revoked; the archive encrypted, with a retention period. |
| 26 | Auth emails land in spam or hit rate limits | Medium / medium | Resend with DKIM and SPF on `mail.vortexhub.dev`; Cloudflare DMARC Management at `p=none`, then quarantine; Supabase limit raised. Add SPF, DKIM and DMARC for vortexhub.ro (Google Workspace) separately. |
| 27 | New auth settings differ from today's (confirmation, password rules) | Medium / medium | Copied from the Lovable screenshots (2.2 f). |
| 28 | Google's screen shows `<ref>.supabase.co`, or brand verification is late | Medium / low | `auth.vortexhub.dev` (D-1); verification submitted on 7 October. Late verification only hides the logo. |
| 29 | Going back after users wrote to the new site loses data | Low / medium | Lossless go/no-go #2 on `next.vortexhub.dev`; copy-back documented; Lovable Cloud kept 14 days. |
| 30 | Losing the domain (it renews through Lovable's workspace) | Low / high | Valid card in Lovable; renewal date 2027-06-10; transfer later as in 3g option B. |
| 31 | Toolchain drift (Nitro pinned beta `3.0.260603-beta`, TanStack pinned exactly) | Low / medium | `bun install --frozen-lockfile`; upgrades only on purpose. |
| 32 | Weekend switch with no support reachable | Removed | Thursday evening; Saturday is only the fallback. |
| 33 | GDPR: new processors and hosting location | Certain / low | Supabase eu-central-1, Sentry EU, Resend eu-west-1 sending; privacy page updated on day +1. |

---

## 5. Monthly cost, before and after

USD to lei at 4.765 (ECB reference rate for 2026-10-02). All prices are before VAT.

| Item | Before (on Lovable) | After (own stack) |
|---|---|---|
| Lovable plan | Pro $25 (119 lei). **Confirm** on D1; Business would be $50 | $0 if dropped, or $25 (119 lei) if kept as editor |
| Lovable Cloud usage above the 20-credit monthly grant | Varies; top-ups $15 (71.5 lei) per 50 credits | $0 |
| Hosting | included | Cloudflare Workers Paid $5 (23.8 lei) |
| Database, auth, storage, realtime | Lovable Cloud (credits) | Supabase Pro $25 (119.1 lei); Micro compute covered by the $10 credit |
| Login domain `auth.vortexhub.dev` (D-1) | — | Supabase custom domain $10 (47.7 lei) |
| Staging, PR previews | none | $0 (Supabase Free org; Cloudflare included; Access ≤ 50 users) |
| Auth email | included | Resend Free $0 (3,000/month, 100/day) |
| Errors, uptime, analytics | none / Lovable analytics | Sentry free, Better Stack free, Cloudflare Web Analytics: $0 |
| Backups | Lovable daily, about 14 days | Supabase 7 days plus a nightly R2 dump (≤ 10 GB free): $0 |
| vortexhub.dev renewal | Through Lovable, billed separately (price shown in Workspace domains) | Same (about $1/month at Cloudflare's price if transferred later) |
| Anthropic API | the same | the same; the app caps it at $15/day by default, so at most about $450/month |
| **Fixed total** | **about $25 + credits ≈ 120 lei + usage** | **about $41 ≈ 195 lei** (Lovable dropped, with the login domain); $31 ≈ 148 lei without it; **about $66 ≈ 315 lei** with Lovable kept |
| If the company is not VAT-registered | +21% on reverse-charged services | $41 → about $49.6 ≈ 236 lei; $66 → about $79.9 ≈ 381 lei |
| Transition month (both running) | — | about $66 + Lovable credits |
| Optional later | — | Resend Pro +$20 (95 lei); Sentry Team +$26 (124 lei); point-in-time recovery +$105 (500 lei) |

Google Workspace, the vortexhub.ro registration at Hostico and Stripe fees don't change.

The main gains are not price:
- direct database access and our own backups
- the service-role key in our hands
- no backend pausing because credits ran out
- our own Google login
- staging, CI and approved production deploys

---

## 6. Timeline: what happens each day and what Mihai does

| Day | Date | Engineer (E) | Mihai (M) | M time |
|---|---|---|---|---|
| — | Sun 10-04 | Final plan (this file) | Read sections 0, 2 and 6 (WhatsApp automation day) | 30 min |
| D1 | Mon 10-05 | 3a PRs, all 15 items. The webhook fix, the June migration fix, the idempotent migrations and the `deploy/` configs come first. | Section 2: accounts (Cloudflare Workers Paid + zone; Supabase Pro + Free staging org + custom-domain add-on; Google OAuth client; Sentry; Better Stack; GitHub environments). Stripe facts (endpoint URL, live subscriptions, live and test restricted keys, `whsec`). New Anthropic, Brave, Places and PageSpeed keys. `DEEP_RUN_SECRET` into Lovable at a quiet moment. Lovable facts and screenshots (2.2). Decisions D-1 to D-3 and the `DEEP_*` values. 2 test accounts. | 2.5–3 h |
| D2 | Tue 10-06 | Copy the DNS to Cloudflare and verify it; Supabase staging (`db push` plus the run-twice test); merge 3a; first staging deploy once the zone is active | **07:00: switch nameservers** (after E's OK). After the merge: **Publish once** in Lovable and check that the site looks the same. | 30 min |
| D3 | Wed 10-07 | Zone and Universal SSL **Active**; Search Console TXT; Resend DNS; DMARC Management; staging Worker plus Access apps; prod Supabase including `auth.vortexhub.dev`; prod Worker parked through the first **Deploy production** run | Verify vortexhub.dev in Search Console and **submit Google brand verification**; add the Resend domain; **approve the first production deploy**; type secrets at the `wrangler` prompts | 45 min |
| D4 | Thu 10-08 | Lovable-hostname test (3c), including the rollback drill; write down the night's procedure | Create the throwaway Lovable project and connect `lovtest.vortexhub.dev`; disconnect and reconnect it if E asks | 30 min |
| D5 | Fri 10-09 | Fix staging findings; set the final `DEEP_*` vars; announce the MCP reconnect to its users | **Staging click-through** (3b step 8) | 1 h |
| — | Sat–Sun 10-10/11 | Buffer for zone, SSL or brand-verification delays | — | 0 |
| D8 | Mon 10-12 | **Rehearsal #1:** restore, checks, timings, Q3 fixes; read the token issuer | **DPAs must be accepted by now.** 10:00 **export #1**, storage zip, Q0 to Q3; afternoon app test on `next.vortexhub.dev`; 22:00 maintenance timing test (5 min). **From today: no Lovable prompts that touch the database.** | 1.5 h |
| D9 | Tue 10-13 | Fix the rehearsal #1 findings; prepare the password-reset fallback if needed | Decide the password fallback, if needed | 15 min |
| D10 | Wed 10-14 | **Rehearsal #2:** wipe, restore, checks, timings | 10:00 **export #2**, zip and queries; afternoon app test; **22:00 freeze drill** (20 min). **`main` is frozen from 22:00.** | 1.25 h |
| D11 | Thu 10-15 | 10:00 go/no-go; 20:00 wipe; **21:00 to 24:00 cut-over** (3e) | 10:00 **go/no-go** (20 min). **20:45 to 24:00 cut-over:** maintenance switch, database freeze, final export, storage zip, Stripe resends, login tests, final decision. | 3.5 h |
| D12 | Fri 10-16 | Day +1 tasks (3g); watch; lift the `main` freeze in the evening | Check the site, an email login and a Google login; MCP users reconnect | 30 min |
| — | Sat 10-17 | **Fallback cut-over date** if Thursday was a no-go | (same as Thursday) | (3.5 h) |
| D13–D24 | 10-17 → 10-28 | Backups on, privacy PR, monitoring, weekly Q1 | Note anything odd | — |
| D25 | Thu 10-29 | Verify the archive; cleanup PR afterwards | **Remove Lovable Cloud**; unpublish lovable.app; disconnect the domain from the project; **revoke the old keys**; **decide editor A or B**; downgrade before the next Lovable billing date if B | 45 min |

**Totals.** About 9 engineer-days from D1 to D12, plus cleanup. Mihai: about 13 hours over four weeks.

---

## 7. Still to confirm

| # | Item | Who | When |
|---|---|---|---|
| 1 | vortexhub.dev was bought through Lovable: Workspace domains shows **Configure** with a Nameservers section | M | D1 |
| 2 | Secret names, especially every `DEEP_*`; whether `DEEP_RUN_SECRET` exists; Cloud → Jobs is empty | M | D1 |
| 3 | Database and storage size within the export limits; the Postgres version | M | D1 |
| 4 | The Stripe live endpoint URL and the number of live subscriptions | M | D1 |
| 5 | Name.com keeps answering, or not, after the nameserver change | E | D2 |
| 6 | Whether Lovable lets go of a hostname after a proxied flip (outcome 1 or 2) | E + M | D4 |
| 7 | The storage zip keeps the `<user-uuid>/` folder paths | E | Rehearsal #1 |
| 8 | Old passwords work after the restore | M | Rehearsal #1 |
| 9 | The token `iss` with `auth.vortexhub.dev` active | E | Rehearsal #1 |
| 10 | How long a Lovable secret change takes to reach the live site | M + E | Rehearsal #1 evening |
| 11 | The freeze blocks browser writes on the old site, and the unfreeze restores them | M + E | Rehearsal #2 evening |
| 12 | Option A only: Lovable does not rewrite `.env` once Cloud is removed | E | After day +14 |

---

## 8. What changed from the draft after review (2026-10-04)

- **Blockers fixed in 3a:**
  - The June realtime migration is guarded (item 9).
  - The admin and deep-ledger migration is now truly idempotent and tested twice (item 10).
  - The wrangler config moved to `deploy/` so it can't reach Lovable's build (item 12, guard 3).
- **No DNS gap:**
  - The apex is served through a zone route that is armed in advance and switched on by one record edit, instead of deleting `A @` and attaching a Custom Domain.
  - Rollback is the reverse edit.
  - CI can no longer silently take over apex DNS (guard 2).
  - The `ASSETS` binding became mandatory.
- **Lovable may keep the hostname:** the new test in 3c, the `x-deployment-id` smoke test, and a contingency with honest rollback times.
- **TLS and nameservers:** Universal SSL Active is a go/no-go item. The nameserver switch happens at 07:00 with monitoring, and the 3-hour exposure is stated.
- **Real freeze:** a database-level freeze plus sign-up disabled, drilled in rehearsal #2. Unfreeze is part of every rollback path.
- **Stripe:**
  - The webhook returns 500 on a failed write.
  - Events are resent oldest first, with row checks and a reconciliation afterwards.
  - The endpoint URL and live subscriptions are confirmed on D1.
  - The restricted key has Products and Prices write, and is tested in test mode first.
- **Schema drift:** the Q0 version check, an extended Q3 (auth columns, bucket limits, enums) rerun at T+8, the `transaction_timeout` strip, and no Lovable database prompts from 12 October.
- **Settings and paperwork:** `DEEP_*` values decided explicitly (2.4); auth settings copied from Lovable; DPAs before the first rehearsal; local copies deleted and S3 keys revoked.
- **Google:** brand verification submitted on D3; the `auth.vortexhub.dev` decision made on D1, with an MCP issuer override (item 6).
- **Access:** Bypass apps for `/mcp`, `/.well-known`, the webhook and health. **Wake up** added before exports and in the rollback.
- **Deploys:**
  - Production deploys only a commit that passed staging, shows the migration dry-run, needs Mihai's approval, and dumps to R2 before migrating.
  - `main` is frozen around the night.
  - The CI guard checks that only the expected Supabase project is in the build.
  - The rehearsal wipe is built from `pg_tables`.
  - Action versions are current.
- **Secrets:** values only at prompts and never in argv or history; old credentials revoked on day +14; the GitHub App removed in option B.
- **Email:** DMARC reports through Cloudflare DMARC Management; Resend set up after the zone is active.
- **Facts corrected:**
  - "About six changes" became about 15.
  - The `current_period_end` location is `stripe-webhook.ts:100-102`.
  - Rollback time is about 10 minutes, or 30 to 60+ with a reconnect.
  - Costs are shown before VAT, with the 21% case.
  - Mihai's time is about 13 hours.
- **Schedule:** the 10 October Saturday switch moved to Thursday 15 October (fallback Saturday 17 October) after two rehearsals. Lovable Cloud retires around 29 October.

---

## Sources

**Lovable** (accessed 2026-10-03; local copies in `leave-lovable/lovable/src`):
- external hosting and backend migration: https://docs.lovable.dev/tips-tricks/external-deployment-hosting
- self-hosting: https://docs.lovable.dev/tips-tricks/self-hosting
- export, pause, wake up, remove Cloud: https://docs.lovable.dev/features/advanced-settings
- SQL editor, backups, hidden database password: https://docs.lovable.dev/features/database
- secrets are write-only: https://docs.lovable.dev/features/secrets
- storage download as zip: https://docs.lovable.dev/features/storage
- custom nameservers for Lovable-bought domains: https://docs.lovable.dev/features/custom-domain
- transfer-out: https://docs.lovable.dev/features/transfer-domain
- "Disable sign-up", password rules, auth settings: https://docs.lovable.dev/features/email-auth and https://docs.lovable.dev/features/authentication
- managed vs own Google credentials: https://docs.lovable.dev/features/google-auth
- publish: https://docs.lovable.dev/features/publish
- Git sync and the `lovable-sync` branch: https://docs.lovable.dev/integrations/git-sync-overview
- plans and credits: https://docs.lovable.dev/introduction/subscription-plans and https://docs.lovable.dev/introduction/credits-and-usage
- changelog (Export/Remove Cloud 2026-07-03): https://docs.lovable.dev/changelog

**Supabase:**
- `realtime.messages` owner error (fetched 2026-10-04): https://supabase.com/docs/guides/troubleshooting/realtime-must-be-owner-of-table-messages
- project-to-project restore with `session_replication_role = replica`: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- session pooler: https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore
- moving auth users: https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects
- no access to Lovable Cloud keys: https://supabase.com/docs/guides/troubleshooting/cant-access-supabase-project-lovable-cloud
- Google login (consent screen shows `<ref>.supabase.co` without a custom domain; implicit vs PKCE), fetched 2026-10-04: https://supabase.com/docs/guides/auth/social-login/auth-google
- custom domains (Auth uses the custom domain immediately; the project URL keeps working; add the new callback in addition), fetched 2026-10-04: https://supabase.com/docs/guides/platform/custom-domains
- SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- OAuth 2.1 server: https://supabase.com/docs/guides/auth/oauth-server/getting-started
- signing keys: https://supabase.com/docs/guides/auth/signing-keys
- identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- pricing: https://supabase.com/pricing

**Cloudflare:**
- Custom Domains (updated 2026-09-29): https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- certificate and hostname priority (updated 2026-04-16): https://developers.cloudflare.com/ssl/reference/certificate-and-hostname-priority/
- Cloudflare for SaaS (updated 2026-06-19): https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/saas-customers/how-it-works/
- SOA defaults: https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/
- Universal SSL: https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/enable-universal-ssl/
- Wrangler configuration (updated 2026-10-02): https://developers.cloudflare.com/workers/wrangler/configuration/
- Wrangler custom-domain DNS override: https://github.com/cloudflare/workers-sdk/blob/main/packages/deploy-helpers/src/triggers/publish-routes.ts
- limits (updated 2026-09-05): https://developers.cloudflare.com/workers/platform/limits/
- pricing: https://developers.cloudflare.com/workers/platform/pricing/
- www-to-apex redirect: https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/
- Nitro preset: https://nitro.build/deploy/providers/cloudflare
- GitHub Action: https://github.com/cloudflare/wrangler-action

**Others:**
- Stripe (live retries for 3 days; Dashboard Resend up to 15 days, CLI up to 30): https://docs.stripe.com/webhooks
- Google brand verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- Google `sub` claim: https://developers.google.com/identity/openid-connect/openid-connect
- Resend pricing: https://resend.com/pricing
- Romanian VAT 21% from 2025-08-01: https://www.avalara.com/blog/en/europe/2025/07/blog-romania-vat-rate-changes-2025.html
- GitHub releases API, checked 2026-10-04: `supabase/setup-cli` v3.0.1, `cloudflare/wrangler-action` v4.1.3, `actions/checkout` v7.0.1, `oven-sh/setup-bun` v2.2.0, Supabase CLI v2.119.0

**Live checks (2026-10-03/04):**
- `dig` against name.com and the .dev registry: no DS record; apex A TTL 300 s; delegation TTL 10800 s; no hidden records.
- `whois.cymru.com`: 185.158.133.1 = AS13335.
- `curl -I https://vortexhub.dev`: `server: cloudflare`, `x-deployment-id`.

**Repo** (read-only, origin/main f395969):
- `supabase/migrations/20260610002123_…sql:21`
- `drizzle/migrations/0000_admin_roles_and_deep_ledger.sql`
- `src/routes/api/public/stripe-webhook.ts:50-55,100-102`
- `src/lib/checkout.functions.ts:55-82`
- `src/lib/mcp/index.ts:14-24`
- `src/lib/deep/env.server.ts:103-140,261-266,415-594`
- `src/components/auth/GoogleButton.tsx`
- Nitro `readWranglerConfig()` and `@lovable.dev/vite-tanstack-config` 2.23.1 in `node_modules`

**Third party, lower confidence** (password hashes, `auth.identities` ordering, pg_restore with zstd):
- https://axonbuild.com/blog/moving-off-lovable-cloud/
- https://wz-it.com/en/knowledge/supabase/migrate-lovable-cloud-to-supabase/
- https://dreamlit.ai/changelog/lovable-cloud-to-supabase-exporter
