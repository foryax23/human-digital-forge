import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyPanel, LoadError, Loading, PageHeader } from "@/components/dashboard/PageHeader";
import { formatDay } from "@/components/dashboard/format";
import { Button, IconButton, Panel, PanelDivider, Spinner, Tag } from "@/components/system";
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
  /** "team" for a file the team delivered (drizzle/pending/client_rls_hardening.sql). */
  uploaded_by?: string | null;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const BASE_COLUMNS = "id, name, description, file_path, size_bytes, created_at";

function formatSize(bytes: number | null, lang: "ro" | "en") {
  if (!bytes) return null;
  const n = (v: number, d: number) =>
    v.toLocaleString(lang === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: d });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${n(bytes / 1024, 0)} KB`;
  return `${n(bytes / (1024 * 1024), 1)} MB`;
}

/**
 * The account's files. Asks for uploaded_by first; before the hardening SQL adds that column
 * (Postgres 42703, undefined column) it reads without it and treats every file as the
 * client's own, which is what the database allows until then.
 */
async function readFiles(userId: string) {
  const withOwner = await supabase
    .from("project_files")
    .select(`${BASE_COLUMNS}, uploaded_by` as typeof BASE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (!withOwner.error) return { data: withOwner.data as FileItem[] | null, error: null };
  const code = (withOwner.error as { code?: string }).code;
  if (code !== "42703" && !/uploaded_by/.test(withOwner.error.message ?? ""))
    return { data: null, error: withOwner.error };
  const plain = await supabase
    .from("project_files")
    .select(BASE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: plain.data as FileItem[] | null, error: plain.error };
}

function FilesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    if (!user) return;
    const { data, error } = await readFiles(user.id);
    if (error) console.error("[files] load failed", error);
    setFailed(Boolean(error));
    setFiles(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void loadFiles();
    const channel = supabase
      .channel(`project_files:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_files", filter: `user_id=eq.${user.id}` },
        () => void loadFiles(),
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
      toast.error(
        t(
          "That file is larger than 25 MB. Send a smaller one, or a link by e-mail.",
          "Fișierul are peste 25 MB. Încarcă unul mai mic sau trimite-ne un link pe e-mail.",
        ),
      );
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
        name: file.name.slice(0, 200),
        file_path: path,
        size_bytes: file.size,
      });
      if (insertErr) {
        await supabase.storage.from("project-files").remove([path]);
        throw insertErr;
      }
      toast.success(t("File uploaded", "Fișierul a fost încărcat"));
      await loadFiles();
    } catch (err) {
      console.error("[files] upload failed", err);
      toast.error(
        t("The upload failed. Please try again.", "Încărcarea nu a reușit. Încearcă din nou."),
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDownload(file: FileItem) {
    if (!file.file_path) return;
    setBusyId(file.id);
    try {
      const { data, error } = await supabase.storage
        .from("project-files")
        .createSignedUrl(file.file_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[files] download failed", err);
      toast.error(
        t(
          "We couldn't open that file. Please try again.",
          "Nu am putut deschide fișierul. Încearcă din nou.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(file: FileItem) {
    if (
      !window.confirm(
        t(
          `Delete "${file.name}"? This cannot be undone.`,
          `Ștergi „${file.name}”? Nu se poate anula.`,
        ),
      )
    )
      return;
    setBusyId(file.id);
    try {
      // The row first: when the database refuses (a team file), RLS deletes nothing and
      // returns no row, and the stored file stays intact.
      const { data, error } = await supabase
        .from("project_files")
        .delete()
        .eq("id", file.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("not_deleted");
      if (file.file_path) await supabase.storage.from("project-files").remove([file.file_path]);
      toast.success(t("File deleted", "Fișierul a fost șters"));
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      console.error("[files] delete failed", err);
      toast.error(
        t(
          "We couldn't delete that file. Please try again.",
          "Nu am putut șterge fișierul. Încearcă din nou.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  const uploadButton = (
    <Button
      onClick={() => inputRef.current?.click()}
      loading={uploading}
      disabled={uploading}
      size="md"
    >
      {uploading ? t("Uploading…", "Se încarcă…") : t("Upload a file", "Încarcă un fișier")}
    </Button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t("Files", "Fișiere")}
        lead={t(
          "Documents you send us and what we deliver, up to 25 MB per file. When you upload something new, tell us by e-mail.",
          "Documentele pe care ni le trimiți și ce livrăm noi, maximum 25 MB pe fișier. Când încarci ceva nou, anunță-ne pe e-mail.",
        )}
        actions={uploadButton}
      />
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        aria-hidden
        tabIndex={-1}
      />

      {loading ? <Loading label={t("Loading files", "Se încarcă fișierele")} /> : null}

      {!loading && failed ? (
        <LoadError>
          {t(
            "We couldn't load your files. Refresh the page to try again.",
            "Nu am putut încărca fișierele. Reîncarcă pagina ca să încerci din nou.",
          )}
        </LoadError>
      ) : null}

      {!loading && !failed && files.length === 0 ? (
        <EmptyPanel title={t("No files yet", "Niciun fișier încă")}>
          {t(
            "Upload a brief, a logo or a document. Files we deliver show up here too.",
            "Încarcă un brief, un logo sau un document. Fișierele livrate de noi apar tot aici.",
          )}
        </EmptyPanel>
      ) : null}

      {!loading && !failed && files.length > 0 ? (
        <Panel as="section" aria-label={t("Your files", "Fișierele tale")}>
          <ul>
            {files.map((file, index) => {
              const team = file.uploaded_by === "team";
              const size = formatSize(file.size_bytes, lang);
              return (
                <li key={file.id}>
                  {index > 0 ? <PanelDivider /> : null}
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="type-body-sm flex min-w-0 items-center gap-2 text-fg">
                        <span className="truncate">{file.name}</span>
                        {team ? <Tag>{t("From the team", "De la echipă")}</Tag> : null}
                      </p>
                      <p className="type-micro mt-0.5 text-fg-3">
                        {[formatDay(file.created_at, lang), size, file.description]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {busyId === file.id ? <Spinner size={14} className="mx-2 text-fg-3" /> : null}
                      <IconButton
                        label={t(`Download ${file.name}`, `Descarcă ${file.name}`)}
                        size="md"
                        disabled={busyId === file.id || !file.file_path}
                        onClick={() => handleDownload(file)}
                      >
                        <Download aria-hidden />
                      </IconButton>
                      {/* A team delivery cannot be deleted; the gap keeps the columns aligned. */}
                      {team ? (
                        <span aria-hidden className="size-9" />
                      ) : (
                        <IconButton
                          label={t(`Delete ${file.name}`, `Șterge ${file.name}`)}
                          size="md"
                          disabled={busyId === file.id}
                          onClick={() => handleDelete(file)}
                        >
                          <Trash2 aria-hidden />
                        </IconButton>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
