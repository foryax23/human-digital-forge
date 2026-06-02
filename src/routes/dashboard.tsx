import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Vortex Hub" },
      { name: "description", content: "Your Vortex Hub client workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardShell,
});

function DashboardShell() {
  return (
    <RequireAuth>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </RequireAuth>
  );
}
