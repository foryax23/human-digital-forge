import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  assignClientPlan,
  endClientPlan,
  findClientAccounts,
  getAdminOverview,
  getClientPlanHistory,
  replyToClient,
  setResearchPaused,
  updateClientProject,
} from "@/lib/admin.functions";
import {
  CLIENT_PLAN_IDS,
  CLIENT_PLANS,
  hoursPerMonthLabel,
  isClientPlanId,
  planState,
  reportsLabel,
  romanianDate,
  type AccountMatch,
  type ClientPlanId,
  type ClientPlanRow,
  type PlanState,
  type ResearchAllowance,
} from "@/lib/client-plans";
import { pageMeta } from "@/i18n";
import { monthlyText, PLAN_CATALOG, planLine } from "@/lib/pricing";

export const Route = createFileRoute("/dashboard/admin")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/dashboard/admin"),
  }),
  component: AdminPage,
});

/** A moment as the panel shows it ("1 Oct 2026, 11:00"), in Romanian time whatever the browser. */
const MOMENT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Bucharest",
});
const fmt = (d?: string | null) => (d ? MOMENT.format(new Date(d)) : "—");
/** A contact request's service; "plan-growth" (from "Cere contractul") as the plan's line. */
const serviceText = (s?: string | null) => {
  const plan = s?.match(/^plan-(starter|growth|pro)$/)?.[1];
  return plan && isClientPlanId(plan) ? `Contract: ${planLine(plan).en}` : (s ?? "—");
};
const usd = (n: number) => `$${Number(n).toFixed(2)}`;

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!isAdmin) return <p className="text-fg-2">This page is for the site administrator only.</p>;
  return <AdminContent />;
}

function AdminContent() {
  const fetchOverview = useServerFn(getAdminOverview);
  const pause = useServerFn(setResearchPaused);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (error || !data) return <p className="text-destructive">Could not load the admin data.</p>;

  const emailOf = (id: string) =>
    (data.profiles as { id: string; email: string | null }[]).find((p) => p.id === id)?.email ??
    id.slice(0, 8);

  async function togglePause() {
    try {
      await pause({ data: { paused: !data!.paused } });
      toast.success(data!.paused ? "AI calls resumed" : "AI calls paused for 30 days");
    } catch {
      toast.error(
        data!.paused
          ? "Could not resume AI calls. Please try again."
          : "Could not pause AI calls. Nothing was changed; please try again.",
      );
    }
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  const deep = data.deep;

  return (
    <div className="space-y-6">
      <h1 className="type-title text-fg">Admin panel</h1>
      <Tabs defaultValue="research">
        <TabsList>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="projects">Projects & messages</TabsTrigger>
        </TabsList>

        <TabsContent value="research" className="space-y-4">
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Mode">
              {deep ? deep.mode : "—"}
              {deep?.unknownMode ? ` (unknown value “${deep.unknownMode}”, treated as admin)` : ""}
            </Fact>
            <Fact label="AI text">
              {!deep
                ? "—"
                : !deep.aiKey
                  ? "Off: no ANTHROPIC_API_KEY"
                  : data.paused
                    ? `Paused until ${fmt(data.pausedUntil)}${data.pauseReason && data.pauseReason !== "admin" ? ` (${data.pauseReason})` : ""}`
                    : "On"}
            </Fact>
            <Fact label="Spent today">
              {usd(data.spentToday)}
              {deep ? ` of ${usd(deep.dayBudgetUsd)} daily budget` : ""}
            </Fact>
            <Fact label="Spent last 24h">{usd(data.spent24h)}</Fact>
            <Fact label="Per run">{deep ? `${usd(deep.runBudgetUsd)} budget` : "—"}</Fact>
            <Fact label="Daily runs">
              {deep
                ? `${deep.userDailyCap} per account, ${deep.adminDailyCap} per admin, ${deep.dailyRunCap} for everyone (admins not counted)`
                : "—"}
            </Fact>
            <Fact label="Models">
              {deep ? `${deep.synthesisModel} · ${deep.extractModel}` : "—"}
            </Fact>
            <Fact label="Storage">
              {deep
                ? deep.storage === "tables"
                  ? "Server tables"
                  : deep.storage === "stopgap"
                    ? "Provisional rows (tables missing)"
                    : "Unavailable"
                : "—"}
            </Fact>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant={data.paused ? "default" : "outline"} onClick={togglePause}>
              {data.paused ? "Resume AI calls" : "Pause AI calls (30 days)"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Paused, runs continue rule-based with no AI cost. To stop deep research entirely, set
              DEEP_RESEARCH_MODE=disabled in Lovable Cloud secrets.
            </p>
          </div>
          <Table
            head={[
              "When",
              "User",
              "Company",
              "Access",
              "Text",
              "Status",
              "Duration",
              "Cost",
              "Code",
            ]}
            rows={(data.runs as RunRow[]).map((r) => [
              fmt(r.created_at),
              emailOf(r.user_id),
              `${r.company_name ?? ""} ${r.cui}`.trim(),
              r.via,
              r.ai_mode === "ai" ? "AI" : "Rules",
              runStatus(r),
              duration(r.created_at, r.last_activity_at),
              `${usd(Number(r.spent_usd) + Number(r.reserved_usd))} / ${usd(Number(r.budget_usd))}`,
              r.verify_code ?? "—",
            ])}
          />
          <h2 className="pt-2 font-medium text-fg">Call requests (“Sună-mă”)</h2>
          <Table
            head={["When", "Email", "Phone", "Best time", "CUI", "Language"]}
            rows={(data.callRequests as CallRow[]).map((c) => [
              fmt(c.created_at),
              c.email ?? emailOf(c.user_id),
              c.phone,
              c.call_when === "dimineata"
                ? "Morning"
                : c.call_when === "dupa_amiaza"
                  ? "Afternoon"
                  : c.call_when,
              c.cui ?? "—",
              c.lang ?? "—",
            ])}
          />
          <h2 className="pt-2 font-medium text-fg">Report feedback</h2>
          <Table
            head={["When", "User", "Kind", "Fact", "Message"]}
            rows={(data.feedback as FeedbackRow[]).map((f) => [
              fmt(f.created_at),
              emailOf(f.user_id),
              f.kind,
              f.fact_id ?? "—",
              f.message ?? "—",
            ])}
          />
        </TabsContent>

        <TabsContent value="leads" className="space-y-6">
          <h2 className="font-medium text-fg">Contact requests</h2>
          <Table
            head={["When", "Name", "Email", "Service", "Budget", "Message"]}
            rows={(data.enquiries as Record<string, never>[]).map((e) => [
              fmt(e["created_at"]),
              e["full_name"],
              e["email"],
              serviceText(e["service"]),
              e["budget"] ?? "—",
              e["description"],
            ])}
          />
          <h2 className="font-medium text-fg">Website audit leads</h2>
          <Table
            head={["When", "Name", "Email", "Company", "Score", "Plan"]}
            rows={(data.leads as Record<string, never>[]).map((l) => [
              fmt(l["created_at"]),
              l["full_name"] ?? "—",
              l["email"],
              l["company"] ?? "—",
              String(l["score"]),
              l["recommended_tier"] ?? "—",
            ])}
          />
        </TabsContent>

        <TabsContent value="users">
          <Table
            head={["Joined", "Email", "Name", "Company", "Plan", "Plan status"]}
            rows={(data.profiles as Record<string, never>[]).map((p) => {
              const sub = (data.subscribers as Record<string, never>[]).find(
                (s) => s["user_id"] === p["id"],
              );
              // A plan assigned by contract (Plans tab) first, then a Stripe subscription.
              const contract = data.plans.active.find((r) => r.user_id === p["id"]);
              return [
                fmt(p["created_at"]),
                p["email"] ?? "—",
                p["full_name"] ?? "—",
                p["company"] ?? "—",
                contract ? planName(contract.plan) : (sub?.["tier"] ?? "—"),
                contract
                  ? `contract, ${STATE_LABEL[planState(contract, today())]}`
                  : (sub?.["status"] ?? "—"),
              ];
            })}
          />
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <PlansTab plans={data.plans} deep={deep} emailOf={emailOf} />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          {(data.projects as ProjectRow[]).length === 0 && (
            <p className="text-fg-2">No client projects yet.</p>
          )}
          {(data.projects as ProjectRow[]).map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              email={emailOf(p.user_id)}
              messages={(data.messages as MessageRow[]).filter((m) => m.project_id === p.id)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ plans */

const today = () => romanianDate(Date.now());
const planName = (id: string) => (isClientPlanId(id) ? CLIENT_PLANS[id].label : id);
const STATE_LABEL: Record<PlanState, string> = {
  current: "active",
  scheduled: "starts later",
  expired: "past its end date",
  ended: "ended",
};
/** A calendar day as the panel shows it ("4 Oct 2026"). */
const fmtDay = (d?: string | null) =>
  d
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";

/** What a server error from the plan functions means for the admin. */
function planError(error: unknown): string {
  const m = String((error as Error)?.message ?? "");
  if (m.includes("account_not_found")) return "This account no longer exists.";
  if (m.includes("plans_unavailable"))
    return "Client plans are not set up yet: have Lovable apply drizzle/pending/client_plans.sql first.";
  if (m.includes("plan_dates")) return "The last day is before the first day.";
  if (m.includes("plan_not_active")) return "This plan is no longer active. Reload the panel.";
  if (m.includes("Forbidden")) return "Only the administrator can change plans.";
  return "Nothing was saved. Please try again.";
}

type PlansData = {
  status: "ready" | "missing" | "error";
  active: ClientPlanRow[];
};
type DeepSettings = { mode: string; premiumTiers?: string[] } | null;

function PlansTab({
  plans,
  deep,
  emailOf,
}: {
  plans: PlansData;
  deep: DeepSettings;
  emailOf: (id: string) => string;
}) {
  if (plans.status === "missing")
    return (
      <div className="max-w-2xl space-y-2 rounded-xl border border-dashed border-border bg-card p-4 text-sm">
        <p className="font-medium text-fg">Client plans are not set up yet</p>
        <p className="text-fg-2">
          In the Lovable chat, ask:{" "}
          <span className="text-fg">
            &ldquo;Apply drizzle/pending/client_plans.sql exactly as written.&rdquo;
          </span>{" "}
          The checks to run afterwards are at the top of that file. Until then clients see no plan,
          and deep research admits admins and Stripe subscriptions as before.
        </p>
      </div>
    );
  if (plans.status === "error")
    return <p className="text-destructive">Could not read the client plans. Reload the panel.</p>;
  const researchLive = deep?.mode === "premium" || deep?.mode === "code";
  const tiers = deep?.premiumTiers ?? [];
  return (
    <>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
        {CLIENT_PLAN_IDS.map((id) => {
          const spec = CLIENT_PLANS[id];
          return (
            <Fact key={id} label={spec.label}>
              {`${monthlyText(PLAN_CATALOG[id].priceLei).en} · ${hoursPerMonthLabel(spec.hoursPerMonth, "en")}`}
              <span className="block text-xs text-muted-foreground">
                Deep research:{" "}
                {tiers.includes(id)
                  ? reportsLabel(spec.research.reports, spec.research.period, "en")
                  : "not included (DEEP_RESEARCH_PREMIUM_TIERS)"}
              </span>
            </Fact>
          );
        })}
        <p className="text-xs text-muted-foreground sm:col-span-3">
          {researchLive
            ? `Reports count now (mode ${deep?.mode}): runs started through a plan this period, failed and canceled ones excepted. Admins keep their own caps.`
            : `Reports start counting when DEEP_RESEARCH_MODE=premium (now ${deep?.mode ?? "unknown"}); until then clients see only the plan and its hours.`}
        </p>
      </div>
      <AssignPlan emailOf={emailOf} researchLive={researchLive} />
      <div className="space-y-2">
        <h2 className="font-medium text-fg">Active plans</h2>
        <Table
          head={["Client", "Plan", "State", "First day", "Last day", "Contract", "Assigned by"]}
          rows={plans.active.map((r) => [
            emailOf(r.user_id),
            planName(r.plan),
            STATE_LABEL[planState(r, today())],
            fmtDay(r.starts_on),
            r.ends_on ? fmtDay(r.ends_on) : "no end date",
            r.contract_ref ?? "—",
            r.assigned_by ? emailOf(r.assigned_by) : "—",
          ])}
        />
      </div>
    </>
  );
}

function AssignPlan({
  emailOf,
  researchLive,
}: {
  emailOf: (id: string) => string;
  researchLive: boolean;
}) {
  const find = useServerFn(findClientAccounts);
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState<AccountMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function run(q: string) {
    setSearching(true);
    try {
      const { accounts } = await find({ data: { query: q } });
      setResults(accounts);
      setLastQuery(q);
      if (accounts.length === 1) setSelectedId(accounts[0].id);
    } catch {
      toast.error("The search did not work. Please try again.");
    } finally {
      setSearching(false);
    }
  }
  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) {
      toast.error("Type at least 3 characters of the e-mail.");
      return;
    }
    setSelectedId(null);
    await run(query.trim());
  }
  const selected = results?.find((a) => a.id === selectedId) ?? null;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="font-medium text-fg">Assign a plan</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          After the contract is signed: find the client&apos;s account by e-mail, then set the plan.
          The client needs an account first (they sign up on the site).
        </p>
      </div>
      <form onSubmit={search} className="flex max-w-xl gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Client e-mail, e.g. ana@firma.ro"
          aria-label="Client e-mail"
          autoComplete="off"
        />
        <Button type="submit" disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
        </Button>
      </form>
      {results && results.length === 0 && (
        <p className="text-sm text-fg-2">No account matches “{lastQuery}”.</p>
      )}
      {results && results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setSelectedId(a.id)}
                aria-pressed={a.id === selectedId}
                className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-left text-sm hover:bg-muted/40 ${a.id === selectedId ? "bg-muted/60" : ""}`}
              >
                <span className="min-w-0">
                  <span className="text-fg">{a.email ?? a.id}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[a.fullName, a.company].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-xs text-fg-2">
                  {a.plan ? `${planName(a.plan.plan)}, ${STATE_LABEL[a.plan.state]}` : "No plan"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <ClientPlanEditor
          key={selected.id}
          account={selected}
          emailOf={emailOf}
          researchLive={researchLive}
          onChanged={() => run(lastQuery)}
        />
      )}
    </section>
  );
}

function ClientPlanEditor({
  account,
  emailOf,
  researchLive,
  onChanged,
}: {
  account: AccountMatch;
  emailOf: (id: string) => string;
  researchLive: boolean;
  onChanged: () => void;
}) {
  const fetchHistory = useServerFn(getClientPlanHistory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-plan-history", account.id],
    queryFn: () => fetchHistory({ data: { userId: account.id } }),
  });
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (error || !data || data.status !== "ready")
    return <p className="text-sm text-destructive">Could not read this client&apos;s plans.</p>;
  const active = data.rows.find((r) => r.status === "active") ?? null;
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <p className="font-medium text-fg">{account.email ?? account.id}</p>
        <p className="text-xs text-muted-foreground">
          {active
            ? `${planName(active.plan)}, ${STATE_LABEL[planState(active, today())]} since ${fmtDay(active.starts_on)}`
            : "No active plan"}
          {researchLive && data.research ? ` · ${researchLine(data.research)}` : ""}
        </p>
      </div>
      <PlanForm
        key={active?.id ?? "new"}
        userId={account.id}
        active={active}
        onChanged={onChanged}
      />
      {data.rows.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-fg">History</h3>
          <Table
            head={["Plan", "First day", "Last day", "Contract", "Status", "Assigned", "Ended"]}
            rows={data.rows.map((r) => [
              planName(r.plan),
              fmtDay(r.starts_on),
              r.ends_on ? fmtDay(r.ends_on) : "no end date",
              r.contract_ref ?? "—",
              STATE_LABEL[planState(r, today())],
              `${fmt(r.created_at)}${r.assigned_by ? ` by ${emailOf(r.assigned_by)}` : ""}`,
              r.ended_at
                ? `${fmt(r.ended_at)}${r.ended_by ? ` by ${emailOf(r.ended_by)}` : ""}`
                : "—",
            ])}
          />
        </div>
      )}
    </div>
  );
}

/** "Deep research: 1 of 2 reports used this month, renews 1 Nov". */
function researchLine(r: ResearchAllowance): string {
  if (r.reports === null) return "Deep research: daily caps only";
  const period = r.period === "quarter" ? "this quarter" : "this month";
  const renews = r.renewsAt
    ? `, renews ${new Date(r.renewsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Bucharest" })}`
    : "";
  return r.used === null
    ? `Deep research: ${r.reports} ${period} (usage unavailable)`
    : `Deep research: ${r.used} of ${r.reports} reports used ${period}${renews}`;
}

function PlanForm({
  userId,
  active,
  onChanged,
}: {
  userId: string;
  active: ClientPlanRow | null;
  onChanged: () => void;
}) {
  const assign = useServerFn(assignClientPlan);
  const end = useServerFn(endClientPlan);
  const qc = useQueryClient();
  const [plan, setPlan] = useState<ClientPlanId>(
    active && isClientPlanId(active.plan) ? active.plan : "growth",
  );
  const [startsOn, setStartsOn] = useState(active?.starts_on ?? today());
  const [endsOn, setEndsOn] = useState(active?.ends_on ?? "");
  const [contractRef, setContractRef] = useState(active?.contract_ref ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const changing = Boolean(active && active.plan !== plan);
  const datesWrong = Boolean(endsOn && endsOn < startsOn);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["admin-plan-history", userId] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    onChanged();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (datesWrong) return;
    setBusy(true);
    try {
      const { action } = await assign({
        data: {
          userId,
          plan,
          startsOn,
          endsOn: endsOn || null,
          contractRef: contractRef.trim() || null,
        },
      });
      toast.success(
        action === "created"
          ? `${planName(plan)} assigned`
          : action === "changed"
            ? `Plan changed to ${planName(plan)}; the previous one is kept in the history`
            : "Plan updated",
      );
      refresh();
    } catch (err) {
      toast.error(planError(err));
    } finally {
      setBusy(false);
    }
  }

  async function endNow() {
    if (!active) return;
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setBusy(true);
    try {
      await end({ data: { planId: active.id } });
      toast.success("Plan ended today; it stays in the history");
      refresh();
    } catch (err) {
      toast.error(planError(err));
    } finally {
      setBusy(false);
      setConfirmEnd(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1.3fr)_1fr_1fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`plan-${userId}`}>Plan</Label>
          <Select
            value={plan}
            onValueChange={(v) => {
              if (!isClientPlanId(v)) return;
              setPlan(v);
              // A new plan starts today unless the admin picks a day; back to the same plan,
              // its own first day.
              if (active && v === active.plan) setStartsOn(active.starts_on);
              else if (active && startsOn === active.starts_on) setStartsOn(today());
            }}
          >
            <SelectTrigger id={`plan-${userId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_PLAN_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {CLIENT_PLANS[id].label} ·{" "}
                  {hoursPerMonthLabel(CLIENT_PLANS[id].hoursPerMonth, "en")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`starts-${userId}`}>First day</Label>
          <Input
            id={`starts-${userId}`}
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ends-${userId}`}>Last day (optional)</Label>
          <Input
            id={`ends-${userId}`}
            type="date"
            value={endsOn}
            min={startsOn}
            aria-invalid={datesWrong || undefined}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`contract-${userId}`}>Contract reference</Label>
          <Input
            id={`contract-${userId}`}
            value={contractRef}
            maxLength={120}
            placeholder="e.g. VH-2026-014"
            onChange={(e) => setContractRef(e.target.value)}
          />
        </div>
      </div>
      {datesWrong && (
        <p className="text-xs text-destructive">The last day is before the first day.</p>
      )}
      {changing && (
        <p className="text-xs text-muted-foreground">
          Changing the plan ends the current {planName(active!.plan)} record today and starts a new
          one; the history keeps both.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || datesWrong}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !active ? (
            "Assign plan"
          ) : changing ? (
            `Change to ${planName(plan)}`
          ) : (
            "Save changes"
          )}
        </Button>
        {active && (
          <Button
            type="button"
            size="sm"
            variant={confirmEnd ? "destructive" : "outline"}
            disabled={busy}
            onClick={endNow}
          >
            {confirmEnd ? "Confirm: end the plan today" : "End plan"}
          </Button>
        )}
        {confirmEnd && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmEnd(false)}>
            Keep it
          </Button>
        )}
      </div>
    </form>
  );
}

type RunRow = {
  id: string;
  user_id: string;
  cui: string;
  company_name: string | null;
  via: string;
  ai_mode: string;
  status: string;
  budget_usd: number;
  spent_usd: number;
  reserved_usd: number;
  created_at: string;
  last_activity_at: string;
  verify_code: string | null;
  metrics: { failedSteps?: string[]; missingSteps?: string[] } | null;
  error: string | null;
};
type CallRow = {
  id: string;
  user_id: string;
  email: string | null;
  phone: string;
  call_when: string;
  cui: string | null;
  lang: string | null;
  created_at: string;
};
type FeedbackRow = {
  id: string;
  user_id: string;
  kind: string;
  fact_id: string | null;
  message: string | null;
  created_at: string;
};

/** A run's status, with the steps that failed or never ran for a partial report. */
function runStatus(r: RunRow): string {
  const gaps = [...(r.metrics?.failedSteps ?? []), ...(r.metrics?.missingSteps ?? [])];
  if (r.status === "running")
    return Date.now() - Date.parse(r.last_activity_at) < 10 * 60_000 ? "running" : "paused";
  return gaps.length ? `${r.status} (${gaps.join(", ")})` : r.status;
}

/** Wall time from the start to the last recorded activity. */
function duration(from: string, to: string): string {
  const s = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-fg">{children}</p>
    </div>
  );
}

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  current_step: number;
  next_action: string | null;
};
type MessageRow = {
  id: string;
  project_id: string | null;
  sender: string;
  body: string;
  created_at: string;
};

function ProjectCard({
  project,
  email,
  messages,
}: {
  project: ProjectRow;
  email: string;
  messages: MessageRow[];
}) {
  const update = useServerFn(updateClientProject);
  const reply = useServerFn(replyToClient);
  const qc = useQueryClient();
  const [status, setStatus] = useState(project.status);
  const [stepN, setStepN] = useState(project.current_step);
  const [next, setNext] = useState(project.next_action ?? "");
  const [msg, setMsg] = useState("");

  async function save() {
    await update({
      data: { id: project.id, status, current_step: stepN, next_action: next || null },
    });
    toast.success("Project updated");
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }
  async function send() {
    if (!msg.trim()) return;
    try {
      await reply({ data: { userId: project.user_id, projectId: project.id, body: msg } });
    } catch {
      toast.error("The message was not sent. Please try again.");
      return;
    }
    setMsg("");
    toast.success("Message sent");
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="font-medium text-fg">{project.title}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_auto]">
        <Input value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" />
        <Input
          type="number"
          min={0}
          max={10}
          value={stepN}
          onChange={(e) => setStepN(Number(e.target.value))}
          aria-label="Step"
        />
        <Input
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Next action"
          aria-label="Next action"
        />
        <Button size="sm" onClick={save}>
          Save
        </Button>
      </div>
      {messages.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {messages.map((m) => (
            <li key={m.id}>
              <span className="font-medium text-fg">{m.sender === "team" ? "You" : "Client"}:</span>{" "}
              <span className="text-fg-2">{m.body}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Reply to the client"
        />
        <Button size="sm" variant="outline" onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-fg-2">Nothing yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className="max-w-xs truncate px-3 py-2 text-fg-2" title={String(c)}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
