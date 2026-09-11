import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/files")({
  component: FilesPage,
});

interface FileItem {
  id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  size_bytes: number | null;
  created_at: string;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

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
  const { t } = useI18n();
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("project_files")
      .select("id, name, description, file_path, size_bytes, created_at")
      .order("created_at", { ascending: false });
    if (err) {
      console.error("[files] load failed", err);
      setError(t(
        "We couldn't load your files. Please refresh to try again.",
        "Nu am putut încărca fișierele tale. Te rugăm să reîmprospătezi pagina.",
      ));
    } else {
      setError(null);
      setFiles((data as FileItem[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void loadFiles();

    const channel = supabase
      .channel(`project_files:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_files",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadFiles();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (file.size > MAX_BYTES) {
      toast.error(t("That file is too large. Please keep uploads under 25 MB.", "Fișierul este prea mare. Te rugăm să păstrezi încărcările sub 25 MB."));
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("project-files")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("project_files").insert({
        user_id: user.id,
        name: file.name,
        file_path: path,
        size_bytes: file.size,
      });
      if (insertErr) {
        await supabase.storage.from("project-files").remove([path]);
        throw insertErr;
      }

      toast.success(t("File uploaded", "Fișier încărcat"));
      await loadFiles();
    } catch (err) {
      console.error("[files] upload failed", err);
      toast.error(t("Upload failed. Please try again.", "Încărcarea a eșuat. Te rugăm să încerci din nou."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDownload(file: FileItem) {
    if (!file.file_path) {
      toast.error(t("This file isn't available to download.", "Acest fișier nu este disponibil pentru descărcare."));
      return;
    }
    setBusyId(file.id);
    try {
      const { data, error: err } = await supabase.storage
        .from("project-files")
        .createSignedUrl(file.file_path, 60);
      if (err || !data?.signedUrl) throw err ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[files] download failed", err);
      toast.error(t("We couldn't open that file. Please try again.", "Nu am putut deschide acel fișier. Te rugăm să încerci din nou."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(file: FileItem) {
    setBusyId(file.id);
    try {
      if (file.file_path) {
        await supabase.storage.from("project-files").remove([file.file_path]);
      }
      const { error: err } = await supabase.from("project_files").delete().eq("id", file.id);
      if (err) throw err;
      toast.success(t("File removed", "Fișier șters"));
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      console.error("[files] delete failed", err);
      toast.error(t("We couldn't remove that file. Please try again.", "Nu am putut șterge acel fișier. Te rugăm să încerci din nou."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{t("Files", "Fișiere")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              "Upload documents and download deliverables shared with you.",
              "Încarcă documente și descarcă livrabile partajate cu tine.",
            )}
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          {uploading ? t("Uploading…", "Se încarcă…") : t("Upload file", "Încarcă fișier")}
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-sm border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div className="mt-8 rounded-sm border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl">{t("No files yet", "Niciun fișier încă")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t(
              "Upload a brief, asset, or document — your deliverables will appear here too.",
              "Încarcă un brief, un asset sau un document — livrabilele tale vor apărea și ele aici.",
            )}
          </p>
          <Button onClick={() => inputRef.current?.click()} className="mt-6" disabled={uploading}>
            <UploadCloud className="h-4 w-4" />
            {t("Upload your first file", "Încarcă primul tău fișier")}
          </Button>
        </div>
      )}

      {!loading && !error && files.length > 0 && (
        <ul className="mt-8 space-y-3">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-4 rounded-sm border border-border bg-card p-5"
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
              <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                <p>{formatDate(file.created_at)}</p>
                {formatSize(file.size_bytes) && <p>{formatSize(file.size_bytes)}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("Download file", "Descarcă fișierul")}
                  disabled={busyId === file.id || !file.file_path}
                  onClick={() => handleDownload(file)}
                >
                  {busyId === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("Delete file", "Șterge fișierul")}
                  disabled={busyId === file.id}
                  onClick={() => handleDelete(file)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
