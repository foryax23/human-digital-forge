import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/files")({
  component: FilesPage,
});

interface FileItem {
  id: string;
  name: string;
  description: string | null;
  size_bytes: number | null;
  created_at: string;
}

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("project_files")
        .select("id, name, description, size_bytes, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (err) {
        console.error("[files] load failed", err);
        setError("We couldn't load your files. Please refresh to try again.");
      } else {
        setFiles((data as FileItem[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl">Files</h1>
      <p className="mt-1 text-muted-foreground">
        Documents and deliverables shared with you appear here.
      </p>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl">No files yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Delivered files and shared documents will show up in this space.
          </p>
        </div>
      )}

      {!loading && !error && files.length > 0 && (
        <ul className="mt-8 space-y-3">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                {file.description && (
                  <p className="truncate text-sm text-muted-foreground">{file.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{formatDate(file.created_at)}</p>
                {formatSize(file.size_bytes) && <p>{formatSize(file.size_bytes)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
