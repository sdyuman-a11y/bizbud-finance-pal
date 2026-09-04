import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/integrations/supabase/client";

const TABS = [
  { to: "/individual", label: "Budget planner" },
  { to: "/individual/loans", label: "Loan comparison" },
  { to: "/individual/vault", label: "Document vault" },
  { to: "/chat", label: "FinBuddy" },
];

const CATEGORIES = [
  { value: "loan", label: "Loan agreement" },
  { value: "bill", label: "Bill" },
  { value: "receipt", label: "Receipt" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other financial file" },
] as const;

const MAX_BYTES = 20 * 1024 * 1024;

type Doc = {
  id: string;
  title: string;
  category: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/individual/vault")({
  head: () => ({
    meta: [
      { title: "Personal Document Vault — SecuraFlow" },
      {
        name: "description",
        content:
          "Securely store loan agreements, bills, receipts, insurance documents and other important financial files in your private SecuraFlow vault.",
      },
      { property: "og:title", content: "Personal Document Vault — SecuraFlow" },
      {
        property: "og:description",
        content: "A private, encrypted-at-rest home for your loan agreements, bills, receipts and insurance papers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaultPage,
});

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function VaultPage() {
  const { user, setAuthOpen } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("loan");
  const [notes, setNotes] = useState("");
  const [expires, setExpires] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("Choose a file first");
      if (file.size > MAX_BYTES) throw new Error("Files must be 20 MB or smaller");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("vault").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        user_id: user.id,
        title: title.trim() || file.name,
        category,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        notes: notes.trim() || null,
        expires_at: expires || null,
      });
      if (error) {
        await supabase.storage.from("vault").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Document stored in your vault");
      setFile(null);
      setTitle("");
      setNotes("");
      setExpires("");
      if (fileRef.current) fileRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["documents", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (doc: Doc) => {
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from("vault").remove([doc.file_path]);
    },
    onSuccess: () => {
      toast.success("Document deleted");
      void qc.invalidateQueries({ queryKey: ["documents", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(doc: Doc) {
    const { data, error } = await supabase.storage.from("vault").createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error("Could not open that file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const visible = useMemo(
    () => (filter === "all" ? docs : docs.filter((d) => d.category === filter)),
    [docs, filter],
  );
  const totalSize = docs.reduce((s, d) => s + Number(d.size_bytes ?? 0), 0);
  const expiringSoon = docs.filter(
    (d) => d.expires_at && new Date(d.expires_at).getTime() - Date.now() < 45 * 86_400_000,
  ).length;

  return (
    <AppShell
      title="Personal document vault"
      subtitle="Keep loan agreements, bills, receipts, insurance policies and other important financial files in one private, secure place — only you can open them."
      tabs={TABS}
    >
      {!user ? (
        <div className="surface flex flex-col items-start gap-4 p-8">
          <span className="ink-panel flex size-11 items-center justify-center rounded-xl">
            <Lock className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Sign in to open your vault</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Your documents are stored in a private bucket keyed to your account, so a sign-in is
              required before anything can be uploaded or read.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in to continue
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Documents" value={String(docs.length)} hint="stored securely" />
            <Stat label="Storage used" value={formatSize(totalSize)} hint="20 MB per file" />
            <Stat
              label="Categories"
              value={String(new Set(docs.map((d) => d.category)).size)}
              hint="in use"
            />
            <Stat
              label="Expiring soon"
              value={String(expiringSoon)}
              hint="within 45 days"
              tone={expiringSoon ? "negative" : "positive"}
            />
          </div>

          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Add a document</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  File
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-secondary-foreground"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={file?.name ?? "Car loan agreement 2026"}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Category
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Expiry / renewal date (optional)
                </span>
                <input
                  type="date"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!file || upload.isPending}
              onClick={() => upload.mutate()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Store securely
            </button>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Files live in a private bucket; access links are
              signed and expire after 60 seconds.
            </p>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-lg font-semibold">Your documents</h2>
              {[{ value: "all", label: "All" }, ...CATEGORIES].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFilter(c.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filter === c.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:opacity-80"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="surface p-6 text-sm text-muted-foreground">Loading your vault…</div>
            ) : visible.length === 0 ? (
              <div className="surface p-6 text-sm text-muted-foreground">
                Nothing here yet — upload your first document above.
              </div>
            ) : (
              <ul className="grid gap-3">
                {visible.map((d) => (
                  <li key={d.id} className="surface flex items-center gap-4 p-4">
                    <span className="ink-panel flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <FileText className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.title}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category} ·{" "}
                        {formatSize(Number(d.size_bytes))} ·{" "}
                        {new Date(d.created_at).toLocaleDateString()}
                        {d.expires_at ? ` · expires ${d.expires_at}` : ""}
                      </div>
                      {d.notes ? (
                        <div className="mt-1 truncate text-xs text-muted-foreground">{d.notes}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void download(d)}
                      aria-label={`Open ${d.title}`}
                      className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(d)}
                      aria-label={`Delete ${d.title}`}
                      className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
