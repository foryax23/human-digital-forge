import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { pageMeta } from "@/i18n";

export const Route = createFileRoute("/dashboard")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/dashboard"),
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
