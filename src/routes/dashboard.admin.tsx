import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminOverview,
  replyToClient,
  setDeepCredits,
  setResearchPaused,
  updateClientProject,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/dashboard/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel | Vortex Hub" },
      { name: "description", content: "Vortex Hub administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
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
              e["service"] ?? "—",
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
          <UsersTable
            profiles={data.profiles as UserRow[]}
            subscribers={data.subscribers as { user_id: string; tier: string | null; status: string | null }[]}
            credits={data.credits}
          />
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

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
  created_at: string;
};

function UsersTable({
  profiles,
  subscribers,
  credits,
}: {
  profiles: UserRow[];
  subscribers: { user_id: string; tier: string | null; status: string | null }[];
  credits: { user_id: string; plan: string; credits: number }[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = profiles.filter(
    (p) => !q || [p.email, p.full_name, p.company].some((v) => v?.toLowerCase().includes(q)),
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-2">
        Everyone can run deep research with their checks. A new account gets 1 free check;
        Premium gives 4. Changing the plan resets the checks to that amount; you can also set
        any number of checks.
      </p>
      <Input
        placeholder="Search by email, name or company"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />
      {rows.length === 0 ? (
        <p className="text-sm text-fg-2">Nothing yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                {["Joined", "Email", "Name", "Paid plan", "Research plan", "Checks left", ""].map(
                  (h, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const sub = subscribers.find((s) => s.user_id === p.id);
                const c = credits.find((x) => x.user_id === p.id);
                return (
                  <UserCreditsRow
                    key={p.id}
                    user={p}
                    paid={sub ? `${sub.tier ?? "—"} (${sub.status ?? "—"})` : "—"}
                    plan={c?.plan === "premium" ? "premium" : "free"}
                    left={c ? c.credits : 1}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserCreditsRow({
  user,
  paid,
  plan,
  left,
}: {
  user: UserRow;
  paid: string;
  plan: "free" | "premium";
  left: number;
}) {
  const save = useServerFn(setDeepCredits);
  const qc = useQueryClient();
  const [checks, setChecks] = useState(String(left));
  const [busy, setBusy] = useState(false);

  async function apply(input: { plan?: "free" | "premium"; credits?: number }) {
    setBusy(true);
    try {
      const out = await save({ data: { userId: user.id, ...input } });
      setChecks(String(out.credits));
      toast.success(`${user.email ?? "User"}: ${out.plan}, ${out.credits} checks`);
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error("Could not save. Nothing was changed; please try again.");
    } finally {
      setBusy(false);
    }
  }

  const n = Number(checks);
  const valid = Number.isInteger(n) && n >= 0 && n <= 1000;
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 text-fg-2">{fmt(user.created_at)}</td>
      <td className="max-w-xs truncate px-3 py-2 text-fg-2">{user.email ?? "—"}</td>
      <td className="max-w-[10rem] truncate px-3 py-2 text-fg-2">{user.full_name ?? "—"}</td>
      <td className="px-3 py-2 text-fg-2">{paid}</td>
      <td className="px-3 py-2">
        <select
          aria-label={`Research plan for ${user.email ?? user.id}`}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          value={plan}
          disabled={busy}
          onChange={(e) => apply({ plan: e.target.value as "free" | "premium" })}
        >
          <option value="free">Free (1 check)</option>
          <option value="premium">Premium (4 checks)</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <Input
          aria-label={`Checks left for ${user.email ?? user.id}`}
          type="number"
          min={0}
          max={1000}
          value={checks}
          onChange={(e) => setChecks(e.target.value)}
          className="h-9 w-20"
        />
      </td>
      <td className="px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !valid || n === left}
          onClick={() => apply({ credits: n })}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save checks"}
        </Button>
      </td>
    </tr>
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
