import type { FakeSupabase } from "./fake-supabase";

/*
 * The deep ledger as it is APPLIED to the live database, for the fake client: the
 * column defaults of drizzle/migrations/0000_admin_roles_and_deep_ledger.sql and a
 * line-by-line JavaScript port of its five functions (deep_reserve, deep_settle,
 * deep_finish, deep_claim_step, deep_settle_step), plus, with `additions`, the two
 * optional functions of 0001_deep_research_additions.sql (deep_start_run,
 * deep_reclaim_step). Row locks are implicit: the fake runs one call at a time.
 * Keep this in step with the SQL; the store is tested against it, never against
 * the real database.
 */

type Row = Record<string, unknown>;
const ok = (data: unknown) => ({ data, error: null });
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (v: unknown) => Date.parse(String(v ?? "")) || 0;
const num = (v: unknown) => Number(v ?? 0);

export function installLovableLedger(db: FakeSupabase, opts: { additions?: boolean } = {}) {
  db.defaults.deep_runs = (now) => ({
    lang: "ro",
    ai_mode: "rules",
    status: "running",
    budget_usd: 0,
    reserved_usd: 0,
    spent_usd: 0,
    consent: null,
    report: null,
    report_att: null,
    verify_code: null,
    metrics: null,
    error: null,
    company_name: null,
    relationship: null,
    last_activity_at: iso(now),
  });
  db.defaults.deep_calls = () => ({
    status: "reserved",
    reserved_usd: 0,
    usd: 0,
    usage: null,
    result: null,
  });
  db.defaults.deep_slots = () => ({ used: 0, in_flight_at: null, result: null });
  db.defaults.deep_claims = () => ({ exclusive: true });
  db.defaults.deep_breaker = (now) => ({ id: 1, until: iso(now), reason: null });

  const runs = () => db.rows("deep_runs");
  const run = (id: unknown) => runs().find((r) => r.id === id);
  const now = () => db.now();

  db.rpcs.deep_reserve = (a) => {
    const r = run(a.p_run);
    if (!r) return ok({ ok: false, reason: "run_not_found" });
    if (r.status !== "running") return ok({ ok: false, reason: "run_closed" });
    const prev = db
      .rows("deep_calls")
      .filter((c) => c.run_id === a.p_run && c.idem_key === a.p_key)
      .sort((x, y) => num(y.attempt) - num(x.attempt))[0];
    let nextAttempt = 1;
    if (prev) {
      nextAttempt = num(prev.attempt) + 1;
      if (prev.status === "settled" && prev.result !== null && prev.result !== undefined)
        return ok({ ok: false, reason: "replay", result: prev.result });
      if (prev.status === "reserved" && ms(prev.created_at) > now() - 2 * 60_000)
        return ok({ ok: false, reason: "in_flight" });
      if (num(prev.attempt) >= 5) return ok({ ok: false, reason: "attempts" });
    }
    const brk = db.rows("deep_breaker").find((b) => num(b.id) === 1);
    if (brk && ms(brk.until) > now()) return ok({ ok: false, reason: "breaker" });
    const usd = num(a.p_usd);
    if (!(usd > 0) || num(r.spent_usd) + num(r.reserved_usd) + usd > num(r.budget_usd) + 1e-9)
      return ok({ ok: false, reason: "run_budget" });
    const dayTotal = runs()
      .filter((x) => ms(x.created_at) >= ms(a.p_day_start))
      .reduce((s, x) => s + num(x.spent_usd) + num(x.reserved_usd), 0);
    if (dayTotal + usd > num(a.p_day_cap) + 1e-9) return ok({ ok: false, reason: "day_budget" });
    r.reserved_usd = num(r.reserved_usd) + usd;
    r.last_activity_at = iso(now());
    const call = db.newRow("deep_calls", {
      run_id: a.p_run,
      idem_key: a.p_key,
      attempt: nextAttempt,
      kind: a.p_kind,
      step: a.p_step,
      model: a.p_model,
      status: "reserved",
      reserved_usd: usd,
    });
    db.rows("deep_calls").push(call);
    return ok({ ok: true, callId: call.id });
  };

  db.rpcs.deep_settle = (a) => {
    const c = db.rows("deep_calls").find((x) => x.id === a.p_call && x.status === "reserved");
    if (!c) return ok(null);
    const usd = Math.max(num(a.p_usd), 0);
    Object.assign(c, { status: "settled", usd, usage: a.p_usage, result: a.p_result });
    const r = run(c.run_id)!;
    r.reserved_usd = Math.max(num(r.reserved_usd) - num(c.reserved_usd), 0);
    r.spent_usd = num(r.spent_usd) + usd;
    r.last_activity_at = iso(now());
    return ok(null);
  };

  db.rpcs.deep_finish = (a) => {
    const r = run(a.p_run);
    if (!r || r.status !== "running") return ok(null);
    for (const c of db.rows("deep_calls"))
      if (c.run_id === a.p_run && c.status === "reserved")
        Object.assign(c, { status: "settled", usd: c.reserved_usd });
    Object.assign(r, {
      spent_usd: num(r.spent_usd) + num(r.reserved_usd),
      reserved_usd: 0,
      status: a.p_status,
      report: a.p_report,
      report_att: a.p_att,
      verify_code: a.p_code,
      metrics: a.p_metrics,
      error: a.p_error,
      last_activity_at: iso(now()),
    });
    return ok(null);
  };

  const slot = (runId: unknown, key: unknown): Row => {
    let s = db.rows("deep_slots").find((x) => x.run_id === runId && x.key === key);
    if (!s) {
      s = db.newRow("deep_slots", { run_id: runId, key });
      db.rows("deep_slots").push(s);
    }
    return s;
  };

  db.rpcs.deep_claim_step = (a) => {
    const r = run(a.p_run);
    if (!r || r.user_id !== a.p_user) return ok({ ok: false, reason: "run_not_found" });
    if (r.status !== "running") return ok({ ok: false, reason: "run_closed" });
    const s = slot(a.p_run, a.p_key);
    const units = Math.max(1, num(a.p_units ?? 1));
    const left = num(a.p_max) - num(s.used);
    let granted: number;
    if (a.p_exclusive) {
      if (s.in_flight_at !== null && ms(s.in_flight_at) > now() - 2 * 60_000)
        return ok({ ok: false, reason: "in_flight" });
      if (units > left) {
        if (s.result !== null && s.result !== undefined)
          return ok({ ok: false, reason: "replay", result: s.result });
        return ok({ ok: false, reason: "exhausted" });
      }
      granted = units;
      s.used = num(s.used) + granted;
      s.in_flight_at = iso(now());
    } else {
      granted = Math.min(units, left);
      if (granted < 1) return ok({ ok: false, reason: "exhausted" });
      s.used = num(s.used) + granted;
    }
    r.last_activity_at = iso(now());
    const claim = db.newRow("deep_claims", {
      run_id: a.p_run,
      key: a.p_key,
      units: granted,
      exclusive: Boolean(a.p_exclusive),
    });
    db.rows("deep_claims").push(claim);
    return ok({ ok: true, claimId: claim.id, granted });
  };

  db.rpcs.deep_settle_step = (a) => {
    const claims = db.rows("deep_claims");
    const i = claims.findIndex((c) => c.id === a.p_claim && c.run_id === a.p_run);
    if (i < 0) return ok(null);
    const [c] = claims.splice(i, 1);
    const s = slot(a.p_run, c.key);
    if (a.p_used !== null && a.p_used !== undefined) {
      const used = Math.max(0, Math.min(num(c.units), num(a.p_used)));
      s.used = num(s.used) - (num(c.units) - used);
    }
    if (c.exclusive) s.in_flight_at = null;
    if (a.p_result !== null && a.p_result !== undefined) s.result = a.p_result;
    return ok(null);
  };

  if (!opts.additions) return;

  db.rpcs.deep_start_run = (a) => {
    const t = now();
    const dayStart = ms(a.p_day_start);
    const mine = runs().filter((r) => r.user_id === a.p_user);
    if (
      mine.some(
        (r) =>
          r.status === "running" &&
          Math.max(ms(r.created_at), ms(r.last_activity_at)) > t - 10 * 60_000,
      )
    )
      return ok({ ok: false, reason: "already_running" });
    if (!a.p_allow_same_company) {
      const prev = mine
        .filter(
          (r) =>
            r.cui === a.p_cui &&
            ms(r.created_at) >= dayStart &&
            (r.status === "succeeded" || r.status === "partial"),
        )
        .sort((x, y) => ms(y.created_at) - ms(x.created_at))[0];
      if (prev) return ok({ ok: false, reason: "same_company_today", replayRunId: prev.id });
    }
    if (
      mine.filter((r) => ms(r.created_at) >= dayStart && r.status !== "canceled").length >=
      num(a.p_user_cap)
    )
      return ok({ ok: false, reason: "daily_cap_user" });
    if (
      a.p_via !== "admin" &&
      runs().filter(
        (r) => ms(r.created_at) >= dayStart && r.via !== "admin" && r.status !== "canceled",
      ).length >= num(a.p_global_cap)
    )
      return ok({ ok: false, reason: "daily_cap_global" });
    const r = db.newRow("deep_runs", {
      user_id: a.p_user,
      cui: a.p_cui,
      company_name: typeof a.p_company === "string" ? a.p_company.slice(0, 200) : null,
      relationship: a.p_relationship,
      lang: a.p_lang ?? "ro",
      via: a.p_via,
      ai_mode: a.p_ai_mode ?? "rules",
      budget_usd: a.p_budget,
      consent: a.p_consent,
    });
    runs().push(r);
    return ok({ ok: true, runId: r.id });
  };

  db.rpcs.deep_reclaim_step = (a) => {
    const r = run(a.p_run);
    if (!r || r.user_id !== a.p_user || r.status !== "running") return ok(false);
    const s = db.rows("deep_slots").find((x) => x.run_id === a.p_run && x.key === a.p_key);
    if (
      !s ||
      s.in_flight_at === null ||
      ms(s.in_flight_at) > now() - 2 * 60_000 ||
      (s.result !== null && s.result !== undefined)
    )
      return ok(false);
    const all = db.rows("deep_claims");
    const gone = all.filter((c) => c.run_id === a.p_run && c.key === a.p_key && c.exclusive);
    db.tables.deep_claims = all.filter((c) => !gone.includes(c));
    const back = gone.reduce((sum, c) => sum + num(c.units), 0);
    s.used = Math.max(num(s.used) - Math.max(back, 1), 0);
    s.in_flight_at = null;
    return ok(true);
  };
}
