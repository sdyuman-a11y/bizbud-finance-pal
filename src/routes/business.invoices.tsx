import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, CheckCircle2, Loader2, Lock, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { currency } from "@/lib/finance";
import {
  analyzeCustomers,
  daysUntil,
  detectFraud,
  isOverdue,
  predictLateRisk,
  reminderMessage,
  type DraftInvoice,
  type Invoice,
} from "@/lib/invoices";

const TABS = [
  { to: "/business", label: "Cash flow" },
  { to: "/business/advisor", label: "Bank advisor" },
  { to: "/business/invoices", label: "Invoice assistant" },
  { to: "/chat", label: "Biz-Chat" },
];

export const Route = createFileRoute("/business/invoices")({
  head: () => ({
    meta: [
      { title: "Smart Invoice Assistant — FinBuddy" },
      {
        name: "description",
        content:
          "Create invoices, flag fake or suspicious ones, predict late payments, send reminders and analyze customer payment behaviour.",
      },
      { property: "og:title", content: "Smart Invoice Assistant — FinBuddy" },
      {
        property: "og:description",
        content: "Invoice creation, fraud detection, late-payment prediction and customer payment analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvoicesPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function riskTone(score: number) {
  return score >= 60 ? "text-destructive" : score >= 30 ? "text-warning" : "text-success";
}

function InvoicesPage() {
  const { user, profile, setAuthOpen } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    invoice_number: "INV-1001",
    customer_name: "",
    customer_email: "",
    issue_date: today(),
    due_date: inDays(30),
    amount: "2500",
    notes: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data as unknown[]).map((row) => {
        const r = row as Invoice & { amount: string | number; fraud_flags: unknown };
        return {
          ...r,
          amount: Number(r.amount),
          fraud_flags: Array.isArray(r.fraud_flags) ? (r.fraud_flags as string[]) : [],
        } as Invoice;
      });
    },
  });

  const draft: DraftInvoice = {
    invoice_number: form.invoice_number,
    customer_name: form.customer_name,
    customer_email: form.customer_email,
    issue_date: form.issue_date,
    due_date: form.due_date,
    amount: Number(form.amount) || 0,
    notes: form.notes,
  };

  const fraud = useMemo(() => detectFraud(draft, invoices), [form, invoices]);
  const late = useMemo(() => predictLateRisk(draft, invoices), [form, invoices]);
  const customers = useMemo(() => analyzeCustomers(invoices), [invoices]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!draft.customer_name.trim()) throw new Error("Add a customer name");
      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        invoice_number: draft.invoice_number.trim(),
        customer_name: draft.customer_name.trim(),
        customer_email: draft.customer_email.trim() || null,
        issue_date: draft.issue_date,
        due_date: draft.due_date,
        amount: draft.amount,
        status: "sent",
        notes: draft.notes.trim() || null,
        fraud_score: fraud.score,
        fraud_flags: fraud.flags,
        late_risk: late.risk,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice created");
      setForm((p) => ({
        ...p,
        invoice_number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_name: "",
        customer_email: "",
        notes: "",
      }));
      void qc.invalidateQueries({ queryKey: ["invoices", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: { status?: string; paid_at?: string; last_reminder_at?: string } }) => {
      const { error } = await supabase.from("invoices").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["invoices", user?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice deleted");
      void qc.invalidateQueries({ queryKey: ["invoices", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function sendReminder(inv: Invoice) {
    const body = reminderMessage(inv, profile?.display_name ?? "Accounts team");
    const subject = `Reminder: invoice ${inv.invoice_number}`;
    patch.mutate({ id: inv.id, values: { last_reminder_at: new Date().toISOString() } });
    if (inv.customer_email) {
      window.location.href = `mailto:${inv.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast.success("Reminder drafted in your mail app");
    } else {
      void navigator.clipboard.writeText(body);
      toast.success("No email on file — reminder copied to clipboard");
    }
  }

  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + i.amount, 0);
  const overdueList = invoices.filter(isOverdue);
  const flagged = invoices.filter((i) => i.fraud_score >= 40);

  return (
    <AppShell
      title="Smart invoice assistant"
      subtitle="Create invoices, catch suspicious ones before they are paid, predict who will pay late, fire off reminders and study each customer's payment behaviour."
      tabs={TABS}
    >
      {!user ? (
        <div className="surface flex flex-col items-start gap-4 p-8">
          <span className="ink-panel flex size-11 items-center justify-center rounded-xl">
            <Lock className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Sign in to manage invoices</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Invoices are private to your business account, so you need to be signed in before
              creating or reviewing them.
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
            <Stat label="Outstanding" value={currency(outstanding)} hint={`${invoices.length} invoices`} />
            <Stat
              label="Overdue"
              value={currency(overdueList.reduce((s, i) => s + i.amount, 0))}
              hint={`${overdueList.length} invoice(s)`}
              tone={overdueList.length ? "negative" : "positive"}
            />
            <Stat label="Flagged as suspicious" value={String(flagged.length)} hint="risk score 40+" tone={flagged.length ? "negative" : "positive"} />
            <Stat label="Customers" value={String(customers.length)} hint="tracked" />
          </div>

          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Create an invoice</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <TextField label="Invoice number" value={form.invoice_number} onChange={set("invoice_number")} />
              <TextField label="Customer" value={form.customer_name} onChange={set("customer_name")} placeholder="Larkspur Bakery Ltd." />
              <TextField label="Customer email" value={form.customer_email} onChange={set("customer_email")} placeholder="billing@customer.com" />
              <TextField label="Issue date" type="date" value={form.issue_date} onChange={set("issue_date")} />
              <TextField label="Due date" type="date" value={form.due_date} onChange={set("due_date")} />
              <TextField label="Amount" type="number" value={form.amount} onChange={set("amount")} />
              <TextField label="Notes" value={form.notes} onChange={set("notes")} className="md:col-span-3" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="size-4" /> Fake invoice check
                  </span>
                  <span className={`numeric text-lg font-semibold ${riskTone(fraud.score)}`}>
                    {fraud.score}/100
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {fraud.flags.length ? (
                    fraud.flags.map((f) => (
                      <li key={f} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                        {f}
                      </li>
                    ))
                  ) : (
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      Nothing suspicious detected in this draft.
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <BellRing className="size-4" /> Late payment prediction
                  </span>
                  <span className={`numeric text-lg font-semibold ${riskTone(late.risk)}`}>
                    {late.risk}%
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {late.reasons.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create invoice
            </button>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
            {isLoading ? (
              <div className="surface p-6 text-sm text-muted-foreground">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="surface p-6 text-sm text-muted-foreground">
                No invoices yet — create your first one above.
              </div>
            ) : (
              <ul className="grid gap-3">
                {invoices.map((inv) => {
                  const due = daysUntil(inv.due_date);
                  const overdue = isOverdue(inv);
                  return (
                    <li key={inv.id} className="surface p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{inv.invoice_number}</span>
                            <span className="text-sm text-muted-foreground">{inv.customer_name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                inv.status === "paid"
                                  ? "bg-success/15 text-success"
                                  : overdue
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {inv.status === "paid" ? "paid" : overdue ? "overdue" : inv.status}
                            </span>
                            {inv.fraud_score >= 40 ? (
                              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning uppercase">
                                suspicious {inv.fraud_score}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Due {inv.due_date}
                            {inv.status === "paid"
                              ? ` · paid ${inv.paid_at ?? ""}`
                              : overdue
                                ? ` · ${Math.abs(due)} day(s) late`
                                : ` · in ${due} day(s)`}
                            {" · late risk "}
                            {inv.late_risk}%
                            {inv.last_reminder_at
                              ? ` · reminded ${new Date(inv.last_reminder_at).toLocaleDateString()}`
                              : ""}
                          </div>
                        </div>
                        <div className="numeric text-sm font-semibold">{currency(inv.amount)}</div>
                        {inv.status !== "paid" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => sendReminder(inv)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
                            >
                              <BellRing className="size-3.5" /> Remind
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                patch.mutate({ id: inv.id, values: { status: "paid", paid_at: today() } })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
                            >
                              <CheckCircle2 className="size-3.5" /> Mark paid
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => remove.mutate(inv.id)}
                          aria-label={`Delete ${inv.invoice_number}`}
                          className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {inv.fraud_flags.length ? (
                        <ul className="mt-3 space-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                          {inv.fraud_flags.map((f) => (
                            <li key={f} className="flex gap-2">
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {customers.length ? (
            <section className="surface overflow-x-auto p-6">
              <h2 className="text-lg font-semibold">Customer payment behaviour</h2>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase">
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Invoices</th>
                    <th className="pb-2">Billed</th>
                    <th className="pb-2">Outstanding</th>
                    <th className="pb-2">Avg days vs due</th>
                    <th className="pb-2">On time</th>
                    <th className="pb-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.customer} className="border-t border-border/70">
                      <td className="py-2 font-semibold">{c.customer}</td>
                      <td className="numeric py-2">{c.invoices}</td>
                      <td className="numeric py-2">{currency(c.billed)}</td>
                      <td className="numeric py-2">{currency(c.outstanding)}</td>
                      <td className="numeric py-2">
                        {c.avgDaysToPay === null ? "—" : `${c.avgDaysToPay > 0 ? "+" : ""}${Math.round(c.avgDaysToPay)}`}
                      </td>
                      <td className="numeric py-2">
                        {c.onTimeRate === null ? "—" : `${Math.round(c.onTimeRate * 100)}%`}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            c.rating === "Risky"
                              ? "bg-destructive/15 text-destructive"
                              : c.rating === "Watch"
                                ? "bg-warning/20 text-warning"
                                : c.rating === "Unknown"
                                  ? "bg-secondary text-secondary-foreground"
                                  : "bg-success/15 text-success"
                          }`}
                        >
                          {c.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
    </label>
  );
}
