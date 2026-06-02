import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const TIMELINE_STEPS = [
  "Request submitted",
  "Brief reviewed",
  "Proposal accepted",
  "Work in progress",
  "Client review",
  "Completed",
] as const;

export interface ProjectRow {
  id: string;
  title: string;
  service_type: string | null;
  status: string;
  current_step: number;
  next_action: string | null;
  created_at: string;
}

export interface ConsultationRow {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string;
}

export interface FileRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  body: string;
  sender: string;
  read: boolean;
  created_at: string;
}

export interface DashboardData {
  projects: ProjectRow[];
  consultation: ConsultationRow | null;
  file: FileRow | null;
  message: MessageRow | null;
}

export function useDashboardData(userId: string | undefined) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectsRes, consultationRes, fileRes, messageRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, title, service_type, status, current_step, next_action, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("consultations")
          .select("id, title, scheduled_at, status")
          .order("scheduled_at", { ascending: true })
          .limit(1),
        supabase
          .from("project_files")
          .select("id, name, description, created_at")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("messages")
          .select("id, body, sender, read, created_at")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const firstError =
        projectsRes.error || consultationRes.error || fileRes.error || messageRes.error;
      if (firstError) throw firstError;

      setData({
        projects: (projectsRes.data as ProjectRow[]) ?? [],
        consultation: (consultationRes.data?.[0] as ConsultationRow) ?? null,
        file: (fileRes.data?.[0] as FileRow) ?? null,
        message: (messageRes.data?.[0] as MessageRow) ?? null,
      });
    } catch (err) {
      console.error("[dashboard] load failed", err);
      setError("We couldn't load your workspace. Please refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
