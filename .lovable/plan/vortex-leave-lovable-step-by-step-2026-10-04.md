# Leaving Lovable, step by step (Route B, 2026-10-04)

**For:** Mihai Dandea, Director, Vortex Hub S.R.L. **Prepared:** Sunday 4 October 2026. **Reviewed:** the same day, against the main plan, the repo and the providers' current docs. No step of this guide has been carried out yet.

**How to read this guide**
- It is the owner's checklist for the route recommended in the comparison of 2026-10-04: **Route B, "data first, website second"**.
- Every command, SQL script and setting is in the main plan, `.lovable/plan/vortex-own-infrastructure-2026-10-03.md`. A reference such as "plan 3e" points to a section there. Where this guide and the plan differ, this guide is newer.
- **Mihai** owns the accounts, pays, and clicks in Lovable, Stripe, Google, Supabase, Cloudflare and GitHub. **Claude** is the engineer: Claude Code on your Mac, working in the repo and on the command line.
- **All times are Romanian time.**
- **The secrets rule.** Every key goes into your password manager first. Then you paste it straight into the field named in the step. Never put a key in chat, in an email or in this document. Claude never asks for a value. When one of Claude's commands on your Mac needs a value (a database password, a file-copy key), you type it yourself at a hidden prompt, as in step 1.8.
- **Password-manager entries used below** (create each one when a step says so): `SB-prod-db-password`, `SB-staging-db-password`, `SB-prod-key-cloudflare`, `SB-prod-key-lovable`, `SB-prod-s3-weekly`, `Google-client-secret`, `Google-staging-client-secret`, `Stripe-live-restricted`, `Stripe-live-whsec`, `Stripe-test-restricted`, `Stripe-test-whsec`, `Anthropic-live`, `Anthropic-staging`, `Brave`, `Places`, `PageSpeed`, `Resend-smtp`, `Sentry-DSN`, `DEEP_RUN_SECRET`, `DEEP-test-codes` (only if you use test codes), `Backup-private-key`, `R2-backup-key`, `Test-account-email`, `Test-account-google`. Section 7 says where each one is pasted and when it goes away.
- **Two repo facts since the plan was written:**
  - Lovable applied `drizzle/migrations/0001_deep_research_additions.sql` on 4 October. Since then **only your own Google account can be admin**; a password login with your email is not admin. Every admin test below therefore uses your Google login.
  - SQL that is written but not applied waits in `drizzle/pending/` (`client_plans.sql`, `stripe_events.sql`); `drizzle/migrations/` is Lovable's record of what is applied (`drizzle/README.md`). Step 1.11 decides what happens to the pending files.
- A fact marked "(checked 2026-10-04)" was re-read in the provider's docs on that date; section 8 lists the pages.

---

## 1. The route in 5 lines

1. **What happens:** on **Thursday 15 October** the database, user accounts and files move to your own Supabase, and the site stays on Lovable's hosting. On **Tuesday 20 October** the website moves to your own Cloudflare with one DNS edit.
2. **Why it is the easiest:** each evening carries only one kind of risk. Lovable's own migration guide describes the database switch. The website step loses nothing and can be undone in about 10 minutes, because both hosts use the same database.
3. **Cost:** about **$41/month (≈195 lei)** from November, before VAT ($49.6 if the company is not VAT-registered; $25 more if you keep Lovable as an editor). October costs about $66 plus Lovable credits, because both run in parallel.
4. **Time:** about **16.5 hours of your time** over 4 weeks, including one 3.5-hour evening and one 45-minute evening. Claude needs about 10 to 11 working days. Lovable Cloud is deleted on **Thursday 29 October**.
5. **The one risky moment** is copying the database and user accounts on 15 October. It is protected by two full rehearsals (12 and 14 October), a database freeze so no row is lost or written twice, a last check where going back costs 5 minutes and loses nothing, and the old Lovable database kept intact for 14 days.

**Condition:** the remix test on 8 and 9 October (step 4.2) must pass. If it fails, use **Route A**, the plan's one-evening move (plan 3e), on the same date. Everything before that date is identical for both routes.

---

## 2. Checklist

Every step gives **who** does it, **where**, **how long** it takes, what to **do**, how to know it **worked**, and what to do **if not**.

### Phase 1 · Monday 5 October: accounts, keys, facts (you 3 to 3.5 h)

**1.1 Cloudflare account** · Mihai · dash.cloudflare.com · 30 min
- **Do:**
  - Sign up with a company email and turn on 2FA.
  - Billing: company name and VAT ID. Turn on billing notifications.
  - Upgrade Workers to **Workers Paid** ($5/month).
  - **Add a domain** → `vortexhub.dev` → **Free** plan. If Cloudflare offers to scan or import the existing DNS records, untick **Proxy imported DNS records** (or skip the import). Every record must stay **DNS only** (grey cloud) until 20 October; Claude checks each one in step 2.1. (Cloudflare docs, checked 2026-10-04.)
  - Do **not** change nameservers yet; that is step 2.2. Do not turn on DNSSEC either; vortexhub.dev has none today (checked 2026-10-04), so nothing has to be switched off first.
  - **Zero Trust:** open it once, choose a team name (for example `vortexhub`) and the **Free** plan. It asks for payment details but charges nothing (checked 2026-10-04). It provides the email-code screen that keeps staging private.
  - **R2:** complete the R2 checkout. It is free up to 10 GB, but Cloudflare requires the checkout before the first storage bucket (checked 2026-10-04). The backups go here.
- **Worked if:** the zone shows that it is waiting for a nameserver change, every imported record shows a grey cloud, and Workers Paid, Zero Trust Free and R2 are active.
- **If not:** if the card is refused, use another company card. Nothing else depends on this today.

**1.2 Supabase projects** · Mihai · supabase.com/dashboard · 25 min
- **Do:**
  - **Production:** a new organization "Vortex Hub S.R.L." on **Pro**, with company billing. In it, project `vortexhub-prod` in region **Frankfurt (eu-central-1)**. Save its database password in `SB-prod-db-password`. Keep the **spend cap ON**. In the project's **Add-ons**, add **Custom domain** ($10/month).
  - **Staging:** a second organization "Vortex Hub Staging" on **Free**, with project `vortexhub-staging` in the same region. Save its password in `SB-staging-db-password`.
- **Worked if:** both projects show as healthy. Send Claude the two project IDs, the part before `.supabase.co`. They are not secret.
- **If not:** if Frankfurt is not offered, stop and tell Claude before choosing another region.

**1.3 Google login clients (two projects)** · Mihai · console.cloud.google.com/auth · 50 min
- **Why two projects (this replaces plan 2.1 row 3):** Google shows your name and logo only after brand verification, and it verifies the brand only when **every** domain on the project's consent screen and clients is verified by you in Search Console (Google docs, checked 2026-10-04). The `<ref>.supabase.co` addresses belong to Supabase, so you can never verify them. Staging therefore gets its own Google project, and the production project lists only vortexhub.dev addresses. In the addresses below, `<prod-ref>` and `<staging-ref>` are the project IDs from step 1.2; Claude sends you the finished list.
- **Do, production:**
  1. Create a new project "vortexhub-auth".
  2. In **Branding**, enter:
     - app name "Vortex Hub", support email and logo;
     - the privacy and terms links;
     - one authorized domain: `vortexhub.dev`.
  3. In **Audience**, choose External and publish the app ("In production").
  4. In **Data access**, add the scopes `openid`, `email` and `profile`.
  5. **Clients → Create client → Web application.**
     - JavaScript origins: `https://vortexhub.dev` and `https://next.vortexhub.dev`.
     - Redirect URI: `https://auth.vortexhub.dev/auth/v1/callback`, the login domain's callback.
     - Only if Claude says on Friday 9 October that `auth.vortexhub.dev` is still not active: also add `https://<prod-ref>.supabase.co/auth/v1/callback`. Brand verification then waits until the login domain works and that line is removed.
  6. Save the client secret in `Google-client-secret`. Send Claude the client ID, which is not secret.
  7. In Supabase **`vortexhub-prod` only**, open **Authentication → Sign In / Providers → Google**, turn it on, and paste the client ID and the secret.
- **Do, staging:**
  1. Create a second project "vortexhub-auth-staging".
  2. **Branding:** app name "Vortex Hub (staging)", support email, **no logo**, authorized domain `<staging-ref>.supabase.co`. **Audience:** External, "In production". **Data access:** the same three scopes. Never submit this project for verification.
  3. **Clients → Create client → Web application.** JavaScript origins `https://staging.vortexhub.dev` and `http://localhost:5184`; redirect URI `https://<staging-ref>.supabase.co/auth/v1/callback`.
  4. Save the secret in `Google-staging-client-secret` and paste the ID and secret into Supabase **`vortexhub-staging` only**, as in point 7 above.
- **Worked if:** each client is listed with exactly its addresses, and Google shows as enabled in both Supabase projects, each with its own client.
- **If not:** send Claude a screenshot of the client page. Brand verification comes on Wednesday (step 3.2), because Google first needs the domain verified. The staging screen will show the `supabase.co` address instead of a name; that is expected and only you and testers see it.

**1.4 Stripe facts and keys** · Mihai · dashboard.stripe.com · 25 min
- **Do:**
  - (a) **Workbench → Webhooks:** check that the live endpoint is exactly `https://vortexhub.dev/api/public/stripe-webhook`. Screenshot its event list for Claude.
  - (b) **Billing → Subscriptions:** count the active and trialing subscriptions and tell Claude the number.
  - (c) On the live endpoint, reveal the signing secret and save it in `Stripe-live-whsec`.
  - (d) **Developers → API keys → Create restricted key** named "vortexhub-web (Cloudflare)", with Checkout Sessions Write, Products Write, Prices Write and Customers Read. These match what the code calls today: checkout creates the product and price inline, and the webhook reads the customer. Save it in `Stripe-live-restricted` at once: Stripe shows a key you create only once (checked 2026-10-04).
  - (e) Switch to **test mode** and repeat (d); save it in `Stripe-test-restricted`. Then add a test webhook endpoint `https://staging.vortexhub.dev/api/public/stripe-webhook` with the same events, and save its secret in `Stripe-test-whsec`.
  - (f) Do **not** roll or delete the key Lovable uses today.
  - (g) Never press **Roll secret** on the live endpoint before 29 October. Lovable uses that signing secret until 20 October and Cloudflare uses the same one afterwards; each endpoint has one secret (checked 2026-10-04).
- **Worked if:** the four entries are saved, and Claude has the screenshot and the count.
- **If not:** if the endpoint points at a `lovable.app` or `supabase.co` address, tell Claude. A new endpoint and secret are then needed (plan 2.1 row 4).

**1.5 New API keys** · Mihai · console.anthropic.com, Brave Search dashboard, console.cloud.google.com · 25 min
- **Do:**
  - **Anthropic:** a workspace "vortexhub-live" with a **monthly limit of $450**, and a new API key in it. Save it in `Anthropic-live`. This key only ever goes into Cloudflare, never into GitHub.
  - **Anthropic, staging:** a second workspace "vortexhub-staging" with a **monthly limit of $20** and its own key, `Anthropic-staging`. The deep-research test on staging (step 5.1) needs it; it also goes only into Cloudflare.
  - **Brave:** a new key in `Brave`.
  - **Google Cloud → APIs & Services → Credentials:** two keys, one restricted to the Places API (`Places`) and one to PageSpeed Insights (`PageSpeed`). Staging uses the same three keys.
- **Worked if:** the five entries are saved.
- **If not:** Claude finds the right page with you. Lovable cannot show the old values, so new keys are needed in any case.

**1.6 Error and uptime tools** · Mihai · sentry.io, betterstack.com · 10 min
- **Do:**
  - **Sentry:** create the organization in the **EU** region; it cannot be changed later. Create a project "vortexhub-web" (Cloudflare Workers) and save its DSN in `Sentry-DSN`.
  - **Better Stack:** a free account.
- **Worked if:** both accounts exist.
- **If not:** skip for now. Neither is needed before Wednesday.

**1.7 GitHub settings** · Mihai · github.com/foryax23/human-digital-forge → Settings · 15 min
- **Do:**
  - In **Environments**, create three:
    - **production**, with required reviewer = you and deployment branch `main`;
    - **production-plan**, with no reviewer;
    - **staging**.
  - Create two tokens for the automatic deploys:
    - Supabase → Account → **Access Tokens** → "github-ci";
    - Cloudflare → My Profile → **API Tokens** → template "Edit Cloudflare Workers", limited to your account and `vortexhub.dev`.
  - Paste each token, and every other value on Claude's list, into **Settings → Secrets and variables → Actions** under the name Claude gives. Values come from the password manager. The two tokens are needed only in GitHub; if one is ever lost, make a new one.
  - The list grows later: the backup keys on Wednesday (step 3.7) and the weekly file-copy key on Friday 16 October (Phase 8).
- **Worked if:** Claude's checklist shows every name present. GitHub shows names, never values.
- **If not:** Claude tells you which name is missing.

**1.8 Give Claude access without sharing secrets** · Mihai + Claude · your Mac's Terminal and browser · 10 min
- **Do:**
  - Claude runs `gh auth login`, `npx wrangler login` and `supabase login`. Each one opens a browser page where you click **Authorize** or **Allow**.
  - Create one more Cloudflare token, "claude-ops", limited to your account and `vortexhub.dev`, with the permissions Claude lists (DNS, redirect rules, Access for the staging screen, R2 for backups). Run the command Claude gives you; it asks for the token without showing it and saves it in a private file on your Mac.
  - The same kind of hidden prompt is used later for every value Claude's commands need on this Mac: the database passwords and each rehearsal's file-copy key. Claude's commands read the file but never print it.
  - Turn on **FileVault** (System Settings → Privacy & Security). The database exports will be stored on this Mac.
- **Worked if:** Claude reports that all four logins work and FileVault is on.
- **If not:** repeat the login that failed.

**1.9 Facts from Lovable** · Mihai · lovable.dev, in the project · 30 min
- **Do:**
  - Send Claude screenshots of (plan 2.2):
    - your plan and next billing date;
    - **Workspace settings → Workspace domains → vortexhub.dev**: whether it shows **Configure**, plus its full DNS record list;
    - **More → Cloud → Secrets**: names only;
    - **Cloud → Overview**: database and storage size, and in **Advanced settings** the Postgres version;
    - every screen of **Cloud → Users → Auth settings**, plus the number of users in **Cloud → Users**;
    - **More → Cloud → Emails**: whether login emails are sent from your own domain, and each email template;
    - **Cloud → Storage**: the list of buckets (only `project-files` is expected).
  - Create two test accounts on vortexhub.dev, one with email and password and one with Google. Save them in `Test-account-email` and `Test-account-google`. Use a Google account that is not yours: your own Google account is the admin and is tested separately.
- **Worked if:** Claude confirms nothing is missing and the database is under 15 GB (Lovable's export limit; the export file may be at most 5 GB, checked 2026-10-04). If **Emails** shows your own sending domain, its DNS records (usually an NS record such as `notify`) must be copied in step 2.1; otherwise Lovable marks that domain Offline and sends login emails from its generic sender until 15 October (checked 2026-10-04). On 4 October vortexhub.dev had no email records at all (no MX, SPF, DMARC or `notify` record), so none is expected.
- **If not:** if there is no **Configure** button, the domain was not bought through Lovable. Tell Claude: step 2.2 then happens at the registrar instead.

**1.10 Report-code secret** · Mihai · Lovable → More → Cloud → Secrets · 5 min, at a quiet hour (for example 23:00)
- **Do:**
  1. Run the one-line Terminal command Claude gives you. It creates a random value and copies it to the clipboard.
  2. Save it in `DEEP_RUN_SECRET`.
  3. In Lovable, **Add secret** with name `DEEP_RUN_SECRET`, paste the value, and save.
- **Worked if:** the name appears in the list. Deep-research report codes issued before this moment stop validating; very few exist.
- **If not:** delete the secret and add it again.

**1.11 Decisions and paperwork** · Mihai · reply to Claude · 10 min
- **Do:**
  - Confirm the login domain `auth.vortexhub.dev`: yes is recommended.
  - Accept the deep-research settings in plan 2.4, or change them.
  - Confirm the dates: data night Thu 15 Oct 21:00 (fallback Sat 17 Oct), website step Tue 20 Oct 21:00, Cloud removal Thu 29 Oct.
  - Accept the data processing agreements (DPAs) of Supabase, Cloudflare, Resend and Sentry. Claude sends the four links. They must be accepted **before Monday 12 October**, when real personal data first lands in the new accounts.
  - **Decide what happens to the two SQL files that are written but not applied** (`drizzle/pending/`):
    - `stripe_events.sql`, the Stripe webhook's record of processed events. It makes Stripe's repeated or late deliveries harmless. **Recommended: apply it**, because it protects exactly the Stripe resends on the data night.
    - `client_plans.sql`, the plans you assign to clients after a contract. Apply it now if you want to assign plans in October; otherwise it waits until after 20 October.
    - **How:** paste the sentence written at the top of the file into the Lovable chat, as `drizzle/README.md` says, then run the read-only checks listed in the same file. Both files only add tables, and the app works before and after, so the order does not matter.
    - **Latest day: Sunday 11 October**, so both rehearsals include the new tables. Claude then adds the same SQL to the new database's migrations. From Monday 12 October no SQL goes through the Lovable chat (Phase 6 rules); a file still pending then is applied only to the new database after 15 October (Phase 8).
- **Worked if:** Claude has your answers, and the four DPAs are accepted by Friday.
- **If not:** a DPA still missing on Sunday 11 moves rehearsal 1 by one day; nothing else waits for it.

**1.12 Code changes** · Claude · GitHub repo `foryax23/human-digital-forge` · Monday and Tuesday
- **Claude does:**
  - Opens pull requests for plan 3a items 1 to 15.
  - Adds two Route B items:
    - **16:** the server reads `VH_SUPABASE_URL`, `VH_SUPABASE_PUBLISHABLE_KEY` and `VH_SUPABASE_SECRET_KEY` first, then the old names. It is used by the contact form, scan leads, the admin panel, deep research, the Stripe webhook and MCP.
    - **17:** a daily GitHub check that fails if the live site's code contains the old Lovable project ID `fihhxvteymkkhvnosuyh`.
  - The first to land are the Stripe webhook fix (item 8), the June migration fix (9), the migrations that are safe to run twice (10, 11) and the configs in `deploy/` (12). The webhook fix, the June fix and a run-twice guard for drizzle `0000` are already written on this Mac but not yet on GitHub (4 October); they go into the first pull requests.
  - **Item 10 changes, because Lovable applied drizzle `0001` on 4 October.** The copy in `supabase/migrations/` must hold `0000` with its all-or-nothing guard **followed by `0001`** (the stricter admin functions, two links from deep research and roles to the user accounts, and two engine functions), plus any pending file you apply by Sunday 11 October. The plan's "create or replace" version of `0000` must **not** be used: run again on a database that already has `0001`, it would bring back the weaker admin check (`drizzle/README.md`, "0000 and re-runs").
  - The maintenance banner (item 2) also tells visitors that afterwards everyone signs in once more, with the same password or Google: logins in progress cannot be carried to the new database.
  - Every change is switched off by default, so the live site behaves exactly as today.
- **Worked if:** every pull request has green checks, and the database changes run cleanly twice on the staging database (step 2.3). The staging website itself only exists from Wednesday (step 3.4), so the pages are checked there.
- **If not:** Claude fixes it before merging. Nothing reaches the live site until you press Publish in step 2.4.

### Phase 2 · Tuesday 6 October: DNS and one Publish (you 30 min)

**2.1 Copy the DNS records** · Claude · Cloudflare zone · done by 06:45
- **Claude does:**
  - Creates every record as **DNS only (grey cloud), TTL 60 s**:
    - A `185.158.133.1` for `@`, `www` and the four portfolio subdomains;
    - the six `_lovable` TXT records;
    - any email record from your Lovable screenshots (none expected, see step 1.9).
  - Sets any record Cloudflare imported in step 1.1 to DNS only and TTL 60 s, and deletes anything that is not in today's list.
  - Compares them with what name.com serves today.
  - Sends you "OK to switch" with the two Cloudflare nameservers.
- **About waiting times (TTL), checked live on 2026-10-04:** today the A records last 300 s in visitors' caches, and the nameserver handover lasts 10,800 s (3 h). The .dev registry sets that 3 h and nobody can lower it, which is why step 2.2 is at 07:00. Cloudflare's records start at 60 s, the lowest Cloudflare allows on Free, so by 20 October any change reaches everyone within a minute. Proxied (orange) records are always 300 s, so going back from orange to grey takes up to 5 minutes (Cloudflare docs, checked 2026-10-04).
- **Email:** vortexhub.dev receives and sends no email today, and your vortexhub.ro mailboxes are not touched by any step in this guide. Login emails keep coming from Lovable until 15 October and from Resend afterwards (step 3.3).
- **If not:** no switch today; move step 2.2 to Wednesday at 07:00.

**2.2 Switch the nameservers** · Mihai · Lovable → Workspace settings → Workspace domains → vortexhub.dev → **Configure** → **Nameservers** · 5 min at 07:00
- **Do:** choose custom nameservers, enter the two Cloudflare names, then **Save**.
- **Worked if:** Cloudflare emails that the zone is **Active**, usually within 3 hours and at most 24. vortexhub.dev and the four portfolio sites still open. Claude checks every 10 minutes.
- **If not:** for up to 3 hours some visitors may fail to reach the sites, and there is nothing to do but wait. To undo, use the same screen and switch back to Lovable's nameservers.

**2.3 Staging database** · Claude · Supabase `vortexhub-staging` · morning
- **Claude does:** applies all migrations to staging, then runs the two new ones a second time.
- **Worked if:** both runs finish without errors, and after the second run the admin functions are still the strict `0001` versions (only a verified Google identity with your email can become admin).
- **If not:** Claude fixes the migration before anything is merged.

**2.4 Merge, then Publish once** · Claude, then Mihai · GitHub, then Lovable → **Publish → Publish changes** · 15 min
- **Do:** Claude merges the pull requests and tells you. Lovable receives them through GitHub sync. Then you press **Publish → Publish changes**.
- **Worked if:**
  - the site looks the same;
  - your test account logs in, and your own Google login still shows the admin panel;
  - Claude confirms that `/api/public/health` answers;
  - in Lovable → More → Cloud → **SQL editor** you run the one read-only query Claude sends, and it answers `true`: the live admin check is still the strict 4 October version. This catches the case where Lovable applies the new migration files from GitHub to its own database, which nobody has ruled out.
- **If not:** Claude reverts the merge on GitHub and you Publish again (10 minutes). Nothing else has changed. If the query answers `false`, tell Claude the same evening: the fix is to apply `0001` again through the Lovable chat, as on 4 October.

### Phase 3 · Wednesday 7 October: staging and the parked new site (you 55 min)

**3.1 Zone extras** · Claude · Cloudflare · as soon as the zone is Active
- **Claude does:**
  - checks that Universal SSL is **Active** for `vortexhub.dev` and `*.vortexhub.dev`;
  - adds the Google Search Console TXT record and the Resend email records (an MX and an SPF TXT record on `send.mail`, and a DKIM TXT record on `resend._domainkey.mail`, all DNS only; Resend docs, checked 2026-10-04);
  - turns on DMARC Management (`p=none`), which also gives DMARC reports an address that works;
  - adds the www → vortexhub.dev redirect rule, which does nothing yet.
- **Worked if:** Cloudflare shows SSL Active and all records saved.
- **If not:** SSL can take up to 24 hours. It is a go/no-go item for later, not urgent today.

**3.2 Google verification** · Mihai · search.google.com/search-console, then console.cloud.google.com/auth → Branding · 10 min
- **Do:**
  1. **Add property → Domain → `vortexhub.dev` → Verify.** Claude has already added the record.
  2. In Branding, **submit for verification**. Google takes 2 to 3 business days.
- **Worked if:** "Ownership verified", and Branding shows verification in progress.
- **If not:** wait an hour and retry. A late verification only hides the logo on Google's screen; it blocks nothing.

**3.3 Email sending** · Mihai · resend.com, then Supabase · 15 min
- **Do:**
  1. Sign up on the Free plan. **Domains → Add** `mail.vortexhub.dev`, region **eu-west-1** (Ireland). Changing the region later means deleting the domain in Resend, adding it again and new DNS records (checked 2026-10-04), so pick Ireland now. Tell Claude, who adds the records, then press **Verify**.
  2. **API Keys → Create** "supabase-smtp" with **Sending access** for `mail.vortexhub.dev` only, and save it in `Resend-smtp`.
  3. In both Supabase projects, open **Authentication → Emails → SMTP Settings**. Paste the key in the password field; Claude gives you the other fields (sender `no-reply@mail.vortexhub.dev`).
- **Worked if:** Resend shows **Verified**, a password-reset email on staging arrives (step 5.1), and Claude sees in that email's headers that SPF, DKIM and DMARC pass.
- **Limits to know (checked 2026-10-04):** Resend Free sends 3,000 emails a month and **100 a day**, shared by staging and production. Supabase allows 30 login emails an hour once your own SMTP is on; Claude raises that to 100.
- **If not:** Claude checks the DNS records.

**3.4 Staging site** · Claude, plus Mihai for secrets · Cloudflare and Supabase staging · Claude most of the day, you 10 min
- **Claude does:**
  - copies the auth settings from your Lovable screenshots;
  - turns on the OAuth server and the signing keys;
  - deploys `staging.vortexhub.dev` behind Cloudflare Access, open only to your email and any engineer you name.
- **You do:**
  1. Supabase staging → **Settings → API Keys → New secret key** "cloudflare-staging".
  2. Cloudflare → **Workers & Pages → `vortexhub-web-staging` → Settings → Variables and Secrets → Add**, type **Secret**, never Text: the next automatic deploy wipes Text values but keeps secrets (Cloudflare docs, checked 2026-10-04). Use the names Claude lists and paste each value, then **Deploy**. The staging values are: the "cloudflare-staging" key, `Stripe-test-restricted`, `Stripe-test-whsec`, `Anthropic-staging`, `Brave`, `Places`, `PageSpeed`, and a staging report-code secret that Claude's command generates (never the live `DEEP_RUN_SECRET`).
- **Worked if:** you can open staging.vortexhub.dev after an email code.
- **If not:** Claude checks the Access rules.

**3.5 Production database** · Claude · Supabase `vortexhub-prod` · Wednesday
- **Claude does:**
  - applies the migrations, which include drizzle `0000` and `0001` (step 1.12) and any pending file you applied;
  - copies the auth settings;
  - sets the site address to `https://vortexhub.dev`, with redirects for `vortexhub.dev`, `www.vortexhub.dev` (until the www redirect works on 20 October) and `next.vortexhub.dev`;
  - turns on the OAuth server for the AI connector (consent page `/.lovable/oauth/consent`, dynamic client registration on) and the asymmetric signing keys, as on staging;
  - writes the email texts in Vortex Hub wording, starting from your screenshots of Lovable's templates;
  - connects `auth.vortexhub.dev` (plan 3b step 6): a CNAME `auth` to Supabase plus a TXT record, both DNS only.
- **Worked if:** `auth.vortexhub.dev` shows as active in Supabase.
- **If not:** Claude retries the check. If it is still pending on Friday, you decide again whether to keep the login domain.

**3.6 Parked production site** · Mihai + Claude · GitHub → Actions, then Cloudflare · 20 min
- **Do:**
  1. Claude starts **Deploy production**. GitHub emails you: open the run → **Review deployments** → tick production → **Approve and deploy**.
  2. Supabase prod → **API Keys → New secret key** "cloudflare"; save it in `SB-prod-key-cloudflare`.
  3. Cloudflare → `vortexhub-web` → **Variables and Secrets → Add**, type **Secret** (never Text, as in step 3.4). Use the names Claude lists:
     - the Supabase key: `SB-prod-key-cloudflare`;
     - Stripe: `Stripe-live-restricted` and `Stripe-live-whsec`;
     - Anthropic: `Anthropic-live`;
     - deep research: `DEEP_RUN_SECRET`; the admin email list (your Google email); the admin user ID list (Claude reads your user ID from the database and sends it; it is not secret); the test codes, only if you use them (Claude's command turns the codes in `DEEP-test-codes` into the stored form);
     - `Brave`, `Places`, `PageSpeed` and `Sentry-DSN`.

     Then **Deploy**.
- **Worked if:** Claude shows that `https://next.vortexhub.dev/api/public/health` reports the new database and the approved commit, and that the Worker's list of secret names is complete. Visitors notice nothing; vortexhub.dev still goes to Lovable.
- **If not:** Claude fixes and runs the deploy again, and you approve again.

**3.7 Backup keys** · Mihai + Claude · your Mac's Terminal, Cloudflare R2, GitHub · 10 min
- **Do:**
  1. In Terminal, run the command Claude gives you. It creates the backup key pair, copies the **private** key to the clipboard and shows only the public key. Save the private key in `Backup-private-key`, and keep a printed copy in the company safe: without it no backup can ever be opened, by anyone.
  2. Cloudflare → **R2 → Manage API tokens → Create**: Object Read & Write, limited to the backup bucket Claude names. Save it in `R2-backup-key`, then paste its two parts into GitHub secrets under the names Claude gives.
- **Worked if:** a test backup of the staging database lands in R2, and you open it once with Claude's command and the private key, typed at a hidden prompt.
- **If not:** Claude checks the token's bucket and permissions. Until it works, a production deploy that carries a database change stops before changing anything, because it backs up first. The nightly backups start on Friday 16 October.

### Phase 4 · Thursday 8 October: two tests (you 1.5 h)

**4.1 Does Lovable let go of a web address?** · Mihai + Claude · Lovable and Cloudflare · 30 min (plan 3c)
- **Do:**
  - **You:**
    1. Create a blank Lovable project "lovtest" and Publish it.
    2. **Project → Settings → Domains → Connect existing domain** → `lovtest.vortexhub.dev`. Claude adds the records Lovable shows.
    3. Wait for **Live**.
  - **Claude** points the address at Cloudflare and checks who answers. If Claude asks, you disconnect and reconnect the domain in "lovtest" while Claude times it.
- **Worked if:** you have one of two answers:
  - **Outcome 1:** Cloudflare answers. The website step is then one DNS edit.
  - **Outcome 2:** Lovable keeps answering. On 20 October you then also disconnect vortexhub.dev in Lovable, and going back takes 30 to 60+ minutes instead of 10.
- **If not:** if "lovtest" never shows **Live** within an hour, Claude checks the records. If it still fails, we plan for outcome 2, the safer procedure.
- **Clean-up:** delete "lovtest"; Claude removes the records.

**4.2 The remix test (decides Route B)** · Mihai + Claude · Lovable · you 1 h on Thursday plus 10 min on Friday; Claude about 3 h
1. **You:** **Project settings → Project actions → Remix**. Leave "Include project history" off. Do **not** connect vortexhub.dev or GitHub to the copy.
2. **You:** Claude sends you two short texts; they hold only public values. In the copy, open **Code**:
   - replace the whole of `.env` with the first text;
   - replace the `project_id` line in `supabase/config.toml` with the second;
   - save.

   This points the copy at the staging database and turns on the new Google login.
3. **You:**
   - Supabase staging → **API Keys → New secret key** "remix-test".
   - Stripe test mode → **Webhooks → Add endpoint** `https://<copy address>.lovable.app/api/public/stripe-webhook`, with the same events as the live endpoint.
   - In the copy, open **More → Cloud → Secrets → Add secret** and add:
     - `VH_SUPABASE_URL` and `VH_SUPABASE_PUBLISHABLE_KEY`, whose values Claude sends (they are public);
     - `VH_SUPABASE_SECRET_KEY`, the "remix-test" key;
     - `STRIPE_SECRET_KEY`, the value of `Stripe-test-restricted`;
     - `STRIPE_WEBHOOK_SECRET`, the new test endpoint's secret.
   - Publish the copy to its `lovable.app` address. Claude adds that address to staging's redirect list. For the AI-connector check only, Claude also sets staging's site address to the copy's address: Supabase shows the consent page at the site address plus the consent path (Supabase docs, checked 2026-10-04), so otherwise the check would test staging instead of the copy. Claude sets it back to `https://staging.vortexhub.dev` right after that check, on Thursday.
4. **Together, everything must pass:**
   - the health page shows the staging database;
   - email login and Google login work;
   - a dashboard message arrives live in a second tab;
   - a file uploads;
   - the contact form saves;
   - a test checkout with card `4242 4242 4242 4242` creates the `subscribers` row, which Claude checks;
   - the MCP consent page opens and approves.
5. **You:** in the copy, **More → Cloud → Overview → Advanced settings → Pause Cloud → Pause**. After 10 minutes, the contact form, the test checkout and Google login must **still** work. Then press **Publish → Publish changes** once and note whether it works while paused.
6. **Friday, you:** in the copy's chat, ask one harmless question, for example "List this app's pages. Do not change anything." Then open **Code → `.env`**: it must still hold the text from point 2. Send Claude a screenshot; Claude checks that the copy's live code holds only the staging ID.
7. **Clean-up after the decision:**
   - in the copy, **Advanced settings → Remove Cloud**, then delete the copy;
   - delete the "remix-test" Supabase key and the test endpoint in Stripe;
   - Claude removes the copy's address from staging's redirect list.
- **Worked if:** points 4, 5 and 6 all pass. If Publish does not work while paused, that alone does not stop Route B: we then press **Wake up** before any Publish until 20 October.
- **If not:** use Route A (step 5.2). The live site was never touched.

### Phase 5 · Friday 9 October: click-through and decision (you 1 h)

**5.1 Staging click-through** · Mihai · staging.vortexhub.dev · 45 to 60 min (plan 3b step 8)
- **Do:**
  - register, open the confirmation email, log in and log out;
  - request a password-reset email;
  - log in with Google;
  - in the dashboard, create a project and send a message that appears live in a second tab;
  - upload and download a file;
  - send the contact form;
  - run a Vortex Scan of a real company; then log in with your own Google account (only that login is admin) and run one deep research;
  - complete a test checkout with card 4242;
  - connect an MCP client to `https://staging.vortexhub.dev/mcp`.
- **Worked if:** everything works and Claude sees no errors in the logs.
- **If not:** Claude fixes it over the weekend, and you repeat the failed items on Monday morning.

**5.2 Decision: B or A** · Mihai · reply to Claude · 5 min, evening
- **Do:**
  - Answer **B** if step 4.2 passed in full.
  - Otherwise answer **A**. Phase 6 stays the same, except step 6.5. On Thursday you follow plan 3e (the DNS edit at +50 instead of the Lovable switch), and plan 3g replaces Phases 8 to 10.
- **Claude then:**
  - fixes the staging findings;
  - sets the final deep-research values;
  - drafts a short "please reconnect your AI connector on Thursday night" note, which you send to MCP users.

### Phase 6 · Monday 12 to Wednesday 14 October: two rehearsals (you about 3 h 10 min)

**Rules from Monday 12 until 29 October:**
- no Lovable chat prompts that touch the database, and no SQL through the Lovable chat, including the `drizzle/pending/` files: their last day was Sunday 11 October (step 1.11);
- keep your Lovable plan paid and with credits, because a backend paused for low balance cannot export and could stop the site;
- `main` is frozen from **Wednesday 22:00 until Friday evening**.

**6.1 Export (Mon and Wed)** · Mihai · Lovable → More → Cloud · 10:00, about 20 min
- **Do:**
  1. In **Overview**, press **Wake up** if you see it.
  2. **Advanced settings → Export project data → Export data → Database → Export → Start export.** Note the time.
  3. When the email arrives, note the time again and download the file into the folder Claude names on this Mac.
  4. **Cloud → Storage → `project-files` → select all → Download** (a zip). Note the number of files. If a folder shows more than one page of items, make sure every page is selected.
  5. **More → Cloud → SQL editor:** paste each query Claude sends (Q0 to Q3), run it, and save the result in the same folder: with the editor's download button if it has one, otherwise copy the result into a text file or take a screenshot. Claude writes Q3 as a short fingerprint, one line per kind of object with a checksum, so no result is too long to save. It also covers what drizzle `0001` changed without adding names: the text of the admin functions and the table links (constraints).
- **Worked if:** the export, the zip and the four results are in the folder, and the zip holds exactly as many files as the "files project-files" line of Q2. If Q3 lists a bucket other than `project-files`, download that one too.
- **If not:** if the export is slow, wait. The waiting time is exactly the number we need for Thursday. If the zip holds fewer files than Q2 counts, tell Claude, who copies the missing ones another way before the restore.
- **Good to know (checked 2026-10-04):** the export contains user accounts with their password hashes but no storage files and no secrets. Lovable also keeps a copy of each export in the project's Cloud storage; it disappears with Lovable Cloud on 29 October.

**6.2 Restore and checks** · Claude, plus Mihai for two keys · Mac and Supabase prod · Monday and Wednesday afternoons
- **You do (5 min):**
  1. In your Terminal, type `SB-prod-db-password` at the hidden prompt Claude's command opens (method of step 1.8).
  2. Supabase prod → **Storage → Settings → S3 access keys → New access key** "copy-<date>". Type its two parts at the next hidden prompt. These keys open every file and ignore all access rules (Supabase docs, checked 2026-10-04), so each one is used for one copy only: delete it in the same screen when Claude says the copy is done.
- **Claude does:**
  - empties the new database first (on Wednesday);
  - restores the data of every public table, including `user_roles` and the `deep_*` tables, and of the user accounts with their password hashes, Google links (identities) and two-step login factors. The structure, including drizzle `0000` and `0001` and any pending file you applied, comes from the migrations. Drizzle's own bookkeeping table is deliberately not copied: the new database keeps its record in `supabase/migrations`;
  - copies the files;
  - runs every check in plan 3d (steps 4 to 6) and compares the Q3 fingerprint of both sides;
  - on Monday, also reads the login issuer and redeploys the parked site.
- **Worked if:** all counts are equal (rows, user accounts, Google links, password users, files, admins = 1) and all checks show 0.
- **If not:** Claude writes the fix, and Wednesday's rehearsal proves it.

**6.3 App test** · Mihai · next.vortexhub.dev · 30 min, Monday and Wednesday afternoons
- **Do:**
  - log in with `Test-account-email` using the **old password**;
  - log in with `Test-account-google` and with your own Google account; each must open the **existing** account with its data;
  - after your Google login, the admin panel must appear (a password login with your email is never admin since 4 October);
  - check dashboard data, messages and invoices;
  - open an old file.
- **Worked if:** everything looks as on vortexhub.dev.
- **If not:** if old passwords fail, Claude prepares a "reset your password" email and banner. You decide on Tuesday 13 (10 min). If more than about 80 users would need that email, Resend Free's limit of 100 a day is too low; Claude then asks you to take Resend Pro ($20) for one month (pricing checked 2026-10-04). If your Google login opens an empty account or no admin panel, it is a no-go until Claude finds why. If Google shows "redirect_uri_mismatch", add the `<prod-ref>.supabase.co` callback to the production client (step 1.3, point 5) and tell Claude; the brand logo then waits.

**6.4 Evening drills on the live site** · Mihai + Claude · Lovable · Mon 22:00 (5 min), Wed 22:00 (20 min)
- **Do (Monday):**
  1. **Add secret** `MAINTENANCE_MODE` with value `1`.
  2. Time how long until the maintenance banner shows. If nothing happens within 2 minutes, ask Claude whether `main` holds anything not yet tested on staging (it is not frozen yet); when Claude says no, Publish.
  3. Claude checks that the Stripe address answers 503.
  4. Delete the secret.
- **Do (Wednesday):**
  1. Turn maintenance on.
  2. In the SQL editor, run the FREEZE script Claude sends, then **Cloud → Users → Auth settings → Disable sign-up**.
  3. While logged in, try a dashboard message and a file upload. **Both must fail.**
  4. Run UNFREEZE, turn sign-up back on, and check that both work again.
  5. Turn maintenance off.
- **Worked if:** both drills behave exactly as described, and the site is normal afterwards.
- **If not:** Thursday is no-go until Claude fixes it; use the fallback date, Saturday 17.

**6.5 The switch package** · Claude, plus Mihai on Wednesday · GitHub and Supabase
- **Claude does:** prepares the **switch pull request** and keeps it approved but **not merged**. It contains public values only:
  - in `.env`, the six Supabase values of `vortexhub-prod`, `VITE_AUTH_GOOGLE_MODE=supabase` and the login issuer;
  - in `supabase/config.toml`, the new project ID.
- **You (Wednesday, 5 min):** Supabase prod → **API Keys → New secret key** "lovable-hosting". Save it in `SB-prod-key-lovable`. Do not put it in Lovable yet.
- **Worked if:** the pull request shows "Approved", and the key is saved.
- **If not:** Thursday's go/no-go answers NO at point 2.

### Phase 7 · Thursday 15 October: data night

Follow section 3A minute by minute.

### Phase 8 · Friday 16 to Monday 19 October: Lovable hosting, your own database (you 40 min)

- **You (Friday, 25 min):**
  - open vortexhub.dev and log in with email and with Google;
  - check that MCP users have reconnected;
  - Supabase prod → Storage settings → S3 access keys: delete every "copy-…" key that is left;
  - create one long-lived key "weekly-backup" there for the weekly file copy, save it in `SB-prod-s3-weekly`, and paste it into GitHub secrets under the names Claude gives.
- **Claude (Friday):**
  - turns on the nightly encrypted backup to Cloudflare R2 and the weekly file copy;
  - stores the final export, encrypted, in R2 `archive/` and deletes the copies on the Mac;
  - confirms the daily old-ID check is green;
  - updates `drizzle/README.md`: from now on new SQL goes into `supabase/migrations/` and reaches the live database only through **Deploy production** with your approval. A file still in `drizzle/pending/` goes the same way;
  - lifts the `main` freeze in the evening.
- **Team (Friday to Monday):** test `next.vortexhub.dev` with your **real** accounts. It is the future Cloudflare site on the same live database, so don't create fake data there.
- **Rules:**
  - don't use Lovable's in-editor preview for tests, because it now talks to the live database;
  - never apply SQL through the Lovable chat: it would change the old, frozen Lovable database, not the live one;
  - code changes still go live through **Publish**.
- **Worked if:** no login errors, and the daily old-ID check stays green.
- **If not:** if the old ID reappears or logins fail, Claude decides with you between a fix and way back R3 (section 4).

### Phase 9 · Tuesday 20 October: website step

- **Afternoon, you, 10 min:** Claude deploys the same commit to Cloudflare, and you approve it in GitHub as in step 3.6.
- **Worked if:** the health page of `next.vortexhub.dev` shows that commit.
- **If not:** the website step moves to Wednesday or Thursday. Nothing is lost by waiting, as long as it happens before 29 October.
- **Evening:** follow section 3B.

### Phase 10 · Wednesday 21 October: tidy up (you 15 min)

- **You:** Supabase prod → **API Keys** → delete the "lovable-hosting" key, after Claude confirms 24 quiet hours on Cloudflare.
- **Claude:**
  - removes `next.vortexhub.dev` from the Supabase redirect list;
  - turns on Cloudflare Web Analytics;
  - opens the privacy-page pull request (new processors; the author tag becomes "Vortex Hub S.R.L.").
- **Worked if:** the key is gone from the list and the site still works.
- **If not:** if anything breaks after the key is deleted, the site was still using Lovable somewhere. Claude finds it; meanwhile create a new key and use way back W.

### Phase 11 · Thursday 29 October: retire Lovable Cloud (you 45 min)

See section 5.

---

## 3. The two evenings, minute by minute

### 3A. Data night, Thursday 15 October

**10:00 go/no-go (Mihai + Claude, 20 min). Every answer must be YES:**
1. The staging click-through, the remix test, both rehearsals and the freeze drill all passed. Either old passwords work, or the reset email is ready.
2. The switch pull request is approved, `SB-prod-key-lovable` is saved, and Claude has sent you the two public `VH_` values.
3. Code item 16 has been live on Lovable since 6 October, and `next.vortexhub.dev/api/public/health` shows the new database.
4. `main` has been frozen since Wednesday 22:00, and there have been no Lovable database prompts or SQL since Monday 12. Each `drizzle/pending/` file is either in both rehearsals or still pending. Lovable has credits.
5. The Stripe facts are confirmed and MCP users have been told.
6. You are free for 5 minutes at 19:50 and from 20:45 to 24:00, with Lovable, Stripe, Supabase, Cloudflare, GitHub and the password manager open.

**Any NO → move everything to Saturday 17 October, 21:00.**

**Timing.** The night starts at 21:00. **X** is the moment the export email arrives; the rehearsals measured how long that takes. With a 45-minute wait, X is about 21:53 and the site reopens about 23:00.

| Time | Who | Do | Check before going on |
|---|---|---|---|
| 19:50 | Mihai | Types `SB-prod-db-password` and tonight's new file-copy key (as in step 6.2) at Claude's hidden prompts. The emptying at 20:00 already needs both | Claude confirms both prompts |
| 20:00 | Claude | Empties the rehearsal data and files from the new database | All counts 0; 0 files |
| 20:45 | Mihai | Opens all tabs. Lovable → More → Cloud → Overview: press **Wake up** if shown | Backend awake |
| 21:00 | Mihai | **Add secret** `MAINTENANCE_MODE` = `1`. Publish only if Monday's drill needed it | Banner on vortexhub.dev; Claude sees the Stripe address answer 503 |
| 21:03 | Mihai | SQL editor: FREEZE script. **Auth settings → Disable sign-up** | Claude confirms the freeze counts; your dashboard message fails |
| 21:08 | Mihai | Runs Q1 to Q3 and saves the results as in step 6.1. **Start export.** Downloads the storage zip | **Check 1:** freeze proven. If not: stop (way back R1) |
| 21:10 to X | Claude | Checks that the zip holds as many files as Q2 counts, then copies them. Compares Q3 with Wednesday's | **Check 2:** structure unchanged and no file missing. If not: stop (R1) |
| X | Mihai, then Claude | You download the export into the folder; Claude restores it | Restore ends without errors |
| X+15 | Claude | Runs all checks and compares with the 21:08 counts | Everything equal, all checks 0 |
| X+30 | Mihai | App test on next.vortexhub.dev (6.3), plus a new upload, a contact form and one scan | All OK |
| **X+45** | **Both** | **Check 3: the last exit that costs nothing.** No-go = R1 (5 min) | Both say GO |
| X+50 | Mihai | Lovable → Secrets → **Add secret** three times: `VH_SUPABASE_URL` and `VH_SUPABASE_PUBLISHABLE_KEY` (values from Claude), `VH_SUPABASE_SECRET_KEY` (from `SB-prod-key-lovable`) | Claude: the health page shows the new database (within Monday's timing) |
| X+53 | Claude, then Mihai | Claude merges the switch pull request. When Lovable shows the commit: **Publish → Publish changes** | Publish finished |
| X+58 | Claude | Checks the live site | **Check 4:** new database on the health page; only the new project ID in the live code; the AI-connector address (`/.well-known/oauth-protected-resource`) names the new login issuer; Stripe still 503. If not: R2 |
| X+60 | Mihai | Deletes `MAINTENANCE_MODE` | Banner gone |
| X+62 | Mihai | On vortexhub.dev: your own Google login opens your existing account with the admin panel; password login with the test account; a reset email arrives; file upload. Reconnect Claude to `https://vortexhub.dev/mcp` | **Check 5:** all OK. If not: R3 now |
| X+70 | Mihai + Claude | Stripe → Webhooks → endpoint → **Event deliveries**: **Resend** each event that failed during the freeze, **oldest first**. Claude checks each `subscribers` row. Stripe also keeps retrying those events on its own, even after a successful resend (checked 2026-10-04); with `stripe_events` applied (step 1.11) the repeats are ignored, without it Claude rechecks the rows at X+80 | No failed deliveries left |
| X+80 | Claude | Compares Stripe's subscriptions with the database. Turns on Better Stack and the daily old-ID check | They match |
| X+85 | Both | **Open.** The old Lovable database stays frozen with sign-up off. Watch errors for 30 minutes | Done by about 23:50 |

The maintenance switch comes off (X+60) **before** the login tests and the Stripe resends. While it is on, the login forms are hidden and the Stripe address refuses every event, so neither could work earlier. This corrects the order in the comparison, which put the resends first.

### 3B. Website step, Tuesday 20 October

**16:00 go/no-go (10 min). Every answer must be YES:**
- Universal SSL is Active.
- `A @` and `A www` are still DNS only (grey) with TTL 60 s.
- Cloudflare runs the same commit as Lovable, and the Worker's list of secret names is complete (step 3.6).
- `next.vortexhub.dev` is healthy, with no errors since Friday.
- The daily old-ID check is green.
- The lovtest outcome (1 or 2) is known.

There is no maintenance, no freeze and no export tonight. Google, Supabase's redirect list and the Stripe endpoint need no change: the address, the login domain and the signing secret stay the same.

`192.0.2.1` below is a placeholder address reserved for examples. With the orange cloud (Proxied) on, Cloudflare answers visitors itself and never sends them to that address.

| Time | Who | Do | Check before going on |
|---|---|---|---|
| 21:00 | Both | Online. Claude notes that Lovable is serving today | Baseline saved |
| 21:05 | Claude | Cloudflare DNS: `A @` from `185.158.133.1` (grey) to `192.0.2.1` **Proxied**, in one save. The same for `A www` | The address now resolves to Cloudflare |
| 21:07 | Mihai | **Outcome 2 only:** Lovable → Project → Settings → Domains → **Disconnect** vortexhub.dev and www | Done |
| 21:10 | Claude | Smoke tests from plan 3e: no Lovable marker, health shows the commit, www goes to vortexhub.dev, Stripe address answers 400, Google login no longer goes to Lovable, the four portfolio sites still open | **All pass.** In outcome 1, if Lovable still answers after 10 minutes, Mihai disconnects as in outcome 2 |
| 21:20 | Mihai | Your logged-in tab stays logged in, because it is the same database. Google login (admin panel visible), password login, upload; MCP still connected | All OK. If not: way back W (10 min, nothing lost) |
| 21:35 | Claude | Stripe deliveries all 200 (either host is fine). Uptime monitor on the new site; the deploy check now reads `https://vortexhub.dev/api/public/health` | OK |
| 21:45 | Both | Done. Watch errors for 30 minutes | No new errors |

---

## 4. How to go back at each stage

| Stage | How | Who | Time | What is lost |
|---|---|---|---|---|
| Code pull requests (5 and 6 Oct) | Revert on GitHub, then Publish in Lovable | Claude, Mihai | 10 min | Nothing |
| Nameservers (6 Oct) | Workspace domains → Configure → Nameservers → back to Lovable's | Mihai | 5 min, plus up to 3 h for DNS to settle | Nothing |
| Tests and rehearsals (8 to 14 Oct) | Nothing to undo on the live site. Maintenance: delete the secret. Freeze drill: UNFREEZE and sign-up back on | Mihai | 5 min | Nothing |
| **R1** Data night, until X+45 | UNFREEZE, sign-up back on, delete `MAINTENANCE_MODE` | Mihai | 5 min | Nothing |
| **R2** Data night, X+50 to X+60 (maintenance still on) | Delete the three `VH_` secrets, Claude reverts the switch pull request, Publish, then R1 | Both | 10 to 15 min | Nothing |
| **R3** After maintenance is off, while Lovable still hosts | **Wake up** the old Cloud if it paused. Maintenance on. Delete the `VH_` secrets, revert the switch, Publish. UNFREEZE and sign-up on. Maintenance off. Stripe: Resend the events since the switch, oldest first. Claude copies back the rows written on the new database (plan 3f), including the `deep_*` tables and any table from a pending file | Both | 10 to 15 min, plus the copy-back | Rows written after the switch, until they are copied back |
| **W** After the website step, until 29 Oct | DNS: `A @` and `A www` back to `185.158.133.1`, DNS only, one save each. Outcome 2: reconnect the domain in Lovable and wait for **Live**. **From 21 Oct** also: a new Supabase key "lovable-hosting-2" pasted into Lovable as `VH_SUPABASE_SECRET_KEY`, then Publish | Claude, Mihai | About 10 min; 30 to 60+ with a reconnect; 5 min more after 21 Oct | Nothing |
| Both data and website (rare) | W first, then R3 | Both | About 30 min | As in R3 |
| After Lovable Cloud is removed (29 Oct) | No way back to Lovable. Fix forward: Supabase daily backups (7 days) or the nightly R2 copies | Claude | Depends | Depends |

---

## 5. After the move

### What to cancel or revoke, and when

| When | What | Who, where |
|---|---|---|
| Fri 16 Oct | Delete the local export copies once the encrypted archive is in R2. Delete the leftover "copy-…" file-copy keys | Claude; you in Supabase → Storage settings (Phase 8) |
| Wed 21 Oct | Delete the "lovable-hosting" Supabase key. Remove `next.vortexhub.dev` from the redirect list | You (Supabase → API Keys); Claude |
| **Thu 29 Oct, not earlier** | 1. You open the archive once with Claude's command and `Backup-private-key`, typed at a hidden prompt. 2. **Lovable → More → Cloud → Overview → Advanced settings → Remove Cloud**: tick both boxes and type the project name. **This cannot be undone.** 3. **Project settings → Unpublish project.** 4. Disconnect vortexhub.dev and www from the project, but **not** from the workspace. 5. Old keys Lovable held: in Stripe → API keys, open the old key's **View request logs**; if nothing but Lovable used it, **Rotate** it with expiration **Now** (Stripe's standard secret key cannot simply be deleted; checked 2026-10-04). Then delete the old Anthropic, Brave, Places and PageSpeed keys, unless another project of yours still uses them. 6. Claude removes "Lovable" from the privacy page | You, 45 min; Claude |
| About 12 November | If two weeks of DMARC reports show only Resend mail, Claude raises DMARC from `p=none` to `quarantine` | Claude |
| Before the next Lovable billing date after 29 Oct | If you drop Lovable: downgrade to Free; it takes effect at the end of the period | You |
| After 29 Oct | Cleanup pull request: Claude removes the Lovable-only code (plan 3g) | Claude |
| **Keep** | The Lovable workspace with a valid card, because the domain renews there on **10 June 2027**. Also keep the `_lovable` records and the four portfolio subdomains | You |
| Later (optional) | Move the domain to Cloudflare Registrar (about $12/year), only once the four portfolio sites no longer depend on Lovable | You + Claude |

### How you keep editing the site

- **Without Lovable (recommended default):**
  1. You tell Claude what you want.
  2. Claude makes the change on a branch and opens a pull request; the automatic checks run.
  3. After the merge, `staging.vortexhub.dev` updates by itself and you look at it.
  4. Claude starts **Deploy production**, and you click **Approve and deploy** in GitHub's email.

  About 2 minutes of your time per release. Other engineers work the same way.
- **With Lovable as an editor** ($25/month, decide on 29 Oct):
  - GitHub sync stays on. Lovable's edits land on `main` and reach staging. Production still needs your approval in GitHub.
  - Lovable's **Publish** button no longer touches vortexhub.dev, so don't use it.
  - Paste the "Project knowledge" text from plan 3g into Lovable. In short: never turn Lovable Cloud on again, never connect Supabase, and change the database only through new files in `supabase/migrations/`, never through the Lovable chat or `drizzle/`.
  - Claude points `.env` at staging so Lovable's preview never touches live data. After Cloud is removed, the preview shows pages, but server features are tested on staging.
- **Dropping Lovable completely:**
  1. Downgrade to Free. The four portfolio sites keep working, because connected domains keep serving after a downgrade. On Free, though, you cannot connect or reconnect a domain, so never disconnect them (Lovable docs, checked 2026-10-04).
  2. **Project settings → Git → Disconnect.**
  3. Uninstall the Lovable GitHub App (GitHub → Settings → Applications).
  4. Claude then protects `main`, so changes need a pull request and passing checks.

---

## 6. One-page summary

| When | What | You do | Claude does | Your time | Done when |
|---|---|---|---|---|---|
| Mon 5 Oct | Accounts and facts | Cloudflare (with Zero Trust and R2), Supabase, two Google projects, Stripe, keys, GitHub, Lovable screenshots, `DEEP_RUN_SECRET`, decisions (including the pending SQL), DPAs | Code changes 1 to 17 | 3 to 3.5 h | Keys saved, pull requests green |
| Tue 6 Oct | DNS and one Publish | 07:00 nameservers; Publish once | Copies DNS, staging database, merges | 30 min | Zone Active, site unchanged |
| Wed 7 Oct | Staging and parked site | Google verification, Resend, approve the deploy, paste secrets, backup keys | Staging, production database, `auth.vortexhub.dev` | 55 min | next.vortexhub.dev healthy; test backup opens |
| Thu 8 Oct | Two tests | lovtest; remix test points 1 to 5 | Runs and judges both tests | 1.5 h | Outcome 1 or 2 known; remix passes |
| Fri 9 Oct | Decision | Staging click-through; remix point 6; say **B** or **A** | Fixes; drafts the MCP note | 1 h | Decision made |
| Sat 10 or Sun 11 Oct | Pending SQL, if chosen in 1.11 | Apply `stripe_events.sql` and/or `client_plans.sql` through the Lovable chat; run their checks | Adds the same SQL to the new database's migrations | 15 min | Checks answer as the files say |
| Mon 12 Oct | Rehearsal 1 | 10:00 export; two keys at hidden prompts; app test; 22:00 maintenance drill | Restore and checks; login issuer | 1 h 35 min | All checks equal |
| Tue 13 Oct | Password decision | Only if old passwords failed | Reset fallback | 15 min | Decided |
| Wed 14 Oct | Rehearsal 2 | 10:00 export; two keys at hidden prompts; app test; 22:00 freeze drill; "lovable-hosting" key | Restore and checks; switch pull request ready | 1 h 20 min | Drill passed; `main` frozen |
| **Thu 15 Oct** | **Data night** | Section 3A | Section 3A | **3.5 h** | Site on Lovable, data in your own Supabase |
| Fri 16 to Mon 19 | Quiet days | Log-in checks; delete the file-copy keys; weekly backup key | Backups, archive, `drizzle/README.md`; lifts the freeze | 40 min | No errors; daily check green |
| **Tue 20 Oct** | **Website step** | Approve the deploy; section 3B | Section 3B | **55 min** | Site on Cloudflare, nothing lost |
| Wed 21 Oct | Tidy up | Delete the Lovable-only key | Redirects, analytics, privacy page | 15 min | Done |
| **Thu 29 Oct** | **Retire Lovable Cloud** | Open the archive, remove Cloud, unpublish, rotate or delete old keys, decide on the editor | Cleanup pull request | 45 min | About $41/month from here |
| | **Total** | | | **about 16.5 h** | |

**Fallback:** if the remix test fails, everything up to 14 October is the same, and on 15 October you follow plan 3e (Route A, one evening, DNS edit at +50).

---

## 7. Every secret: where it goes and when it goes away

Values live only in your password manager and in the field named here. Claude sets the public values itself (project IDs, publishable keys, client IDs, the login issuer, the backup public key).

| Password-manager entry | What it is | Pasted into | Goes away |
|---|---|---|---|
| `SB-prod-db-password` | Production database password | GitHub (production); the hidden prompt at each restore | Keep |
| `SB-staging-db-password` | Staging database password | GitHub (staging) | Keep |
| `SB-prod-key-cloudflare` | Supabase prod secret key "cloudflare" | Cloudflare `vortexhub-web` | Keep |
| `SB-prod-key-lovable` | Supabase prod secret key "lovable-hosting" | Lovable secret `VH_SUPABASE_SECRET_KEY` on the data night | Deleted Wed 21 Oct |
| (none) | Supabase staging keys "cloudflare-staging" and "remix-test" | Cloudflare staging; the remix copy | "remix-test" deleted after the test |
| (none) | Supabase prod file-copy keys "copy-…", one per rehearsal and the night | The hidden prompt only | Deleted after each copy, the last ones on Fri 16 Oct |
| `SB-prod-s3-weekly` | Supabase prod file key for the weekly file copy | GitHub | Keep |
| `Google-client-secret` | Production Google client | Supabase prod → Google | Keep |
| `Google-staging-client-secret` | Staging Google client | Supabase staging → Google | Keep |
| `Stripe-live-restricted` | Live restricted key | Cloudflare `vortexhub-web` | Keep |
| `Stripe-live-whsec` | Live endpoint signing secret | Cloudflare `vortexhub-web` (Lovable already holds the same value) | Keep; never roll before 29 Oct |
| `Stripe-test-restricted` | Test restricted key | Cloudflare staging; the remix copy | Keep |
| `Stripe-test-whsec` | Staging test endpoint secret | Cloudflare staging | Keep (the remix endpoint's secret goes straight into the copy and is deleted with that endpoint) |
| `Anthropic-live` | Live Anthropic key, $450/month limit | Cloudflare `vortexhub-web` only, never GitHub | Keep |
| `Anthropic-staging` | Staging Anthropic key, $20/month limit | Cloudflare staging only | Keep |
| `Brave`, `Places`, `PageSpeed` | Search, Places and PageSpeed keys | Cloudflare production and staging | Keep |
| `Resend-smtp` | Resend sending key | Supabase prod and staging SMTP | Keep |
| `Sentry-DSN` | Sentry project address | Cloudflare `vortexhub-web` | Keep |
| `DEEP_RUN_SECRET` | Report-code secret | Lovable (5 Oct) and Cloudflare `vortexhub-web` | Keep |
| `DEEP-test-codes` | Deep-research test codes, only if you use them | Turned into hashes by Claude's command, then Cloudflare | Keep |
| `Backup-private-key` | Opens every backup | Nowhere online; only at a hidden prompt when a backup is opened. Keep a printed copy in the company safe | Keep forever |
| `R2-backup-key` | Writes backups to R2 | GitHub | Keep |
| `Test-account-email`, `Test-account-google` | Test logins | Used in the tests | Keep for later tests |
| (none) | Supabase "github-ci" token and Cloudflare "Edit Cloudflare Workers" token | GitHub only | Keep; make a new one if lost |
| (none) | Cloudflare "claude-ops" token | The private file on your Mac (step 1.8) | Delete in Cloudflare whenever Claude no longer manages DNS |
| (none) | The old keys Lovable holds: Stripe secret key, Anthropic, Brave, Places, PageSpeed | Lovable | Rotated or deleted Thu 29 Oct (section 5) |

---

## 8. Docs checked for this review (2026-10-04)

- Google, brand verification and authorized domains: developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification and developers.google.com/identity/verification/authentication-verification; `supabase.co` is a public suffix: publicsuffix.org/list
- Supabase: custom domains, Google login, OAuth 2.1 server (consent page = site address + path), custom SMTP (30 emails/hour at first), S3 access keys (ignore access rules), moving auth users: supabase.com/docs/guides/platform/custom-domains, /auth/social-login/auth-google, /auth/oauth-server/getting-started, /auth/auth-smtp, /storage/s3/authentication, /troubleshooting/migrating-auth-users-between-projects
- Cloudflare: record import and DNSSEC (updated 2026-07-29), TTL minimum 60 s and proxied 300 s (2026-04-16), import proxy option (2026-04-16), Zero Trust onboarding (2026-04-17), R2 checkout (2026-04-21), Wrangler `keep_vars` and secrets (2026-10-02): developers.cloudflare.com/dns/zone-setups/full-setup/setup, /dns/manage-dns-records/reference/ttl, /dns/manage-dns-records/how-to/import-and-export, /cloudflare-one/setup, /r2/get-started, /workers/wrangler/configuration
- Stripe: retries 3 days in live mode, Dashboard resend 15 days, resends do not stop automatic retries, order not guaranteed, one secret per endpoint; keys can be rotated or expired: docs.stripe.com/webhooks and docs.stripe.com/keys
- Resend: records on Cloudflare, regions, pricing (Free 3,000/month, 100/day; Pro $20): resend.com/docs/dashboard/domains/cloudflare, /docs/dashboard/domains/regions, resend.com/pricing
- Lovable: export contents, auto-pause, Remove Cloud (docs.lovable.dev/features/advanced-settings); custom email domains (docs.lovable.dev/features/custom-emails); domains after a downgrade (docs.lovable.dev/features/custom-domain)
- Live DNS of vortexhub.dev, read with `dig` on 2026-10-04: A records 300 s, delegation 10,800 s, no MX, SPF, DMARC, `notify` or DS record
