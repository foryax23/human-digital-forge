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
    (data.profiles as { id: string; email: string | null }[]).find((p) => p.id === id)?.email ?? id.slice(0, 8);

  async function togglePause() {
    await pause({ data: { paused: !data!.paused } });
    toast.success(data!.paused ? "Research resumed" : "Research paused");
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }

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
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
            <p>
              Spent last 24h: <strong>{usd(data.spent24h)}</strong>
            </p>
            <p>Status: {data.paused ? "Paused" : "Running"}</p>
            <Button size="sm" variant={data.paused ? "default" : "outline"} onClick={togglePause}>
              {data.paused ? "Resume research" : "Pause all research"}
            </Button>
          </div>
          <Table
            head={["When", "User", "Company", "Access", "Status", "Cost"]}
            rows={(data.runs as Record<string, never>[]).map((r) => [
              fmt(r["created_at"]),
              emailOf(r["user_id"]),
              `${r["company_name"] ?? ""} ${r["cui"]}`,
              r["via"],
              r["status"],
              usd(Number(r["spent_usd"]) + Number(r["reserved_usd"])),
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
          <Table
            head={["Joined", "Email", "Name", "Company", "Plan", "Plan status"]}
            rows={(data.profiles as Record<string, never>[]).map((p) => {
              const sub = (data.subscribers as Record<string, never>[]).find(
                (s) => s["user_id"] === p["id"],
              );
              return [
                fmt(p["created_at"]),
                p["email"] ?? "—",
                p["full_name"] ?? "—",
                p["company"] ?? "—",
                sub?.["tier"] ?? "Free",
                sub?.["status"] ?? "—",
              ];
            })}
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

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  current_step: number;
  next_action: string | null;
};
type MessageRow = { id: string; project_id: string | null; sender: string; body: string; created_at: string };

function ProjectCard({ project, email, messages }: { project: ProjectRow; email: string; messages: MessageRow[] }) {
  const update = useServerFn(updateClientProject);
  const reply = useServerFn(replyToClient);
  const qc = useQueryClient();
  const [status, setStatus] = useState(project.status);
  const [stepN, setStepN] = useState(project.current_step);
  const [next, setNext] = useState(project.next_action ?? "");
  const [msg, setMsg] = useState("");

  async function save() {
    await update({ data: { id: project.id, status, current_step: stepN, next_action: next || null } });
    toast.success("Project updated");
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }
  async function send() {
    if (!msg.trim()) return;
    await reply({ data: { userId: project.user_id, projectId: project.id, body: msg } });
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
        <Input value={next} onChange={(e) => setNext(e.target.value)} placeholder="Next action" aria-label="Next action" />
        <Button size="sm" onClick={save}>Save</Button>
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
        <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Reply to the client" />
        <Button size="sm" variant="outline" onClick={send}>Send</Button>
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
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className="max-w-xs truncate px-3 py-2 text-fg-2" title={String(c)}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
