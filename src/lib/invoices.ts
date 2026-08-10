export type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  fraud_score: number;
  fraud_flags: string[];
  late_risk: number;
  last_reminder_at: string | null;
  created_at: string;
};

export const INVOICE_STATUSES = ["draft", "sent", "paid", "cancelled"] as const;

const DAY = 86_400_000;

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

export function daysUntil(date: string) {
  return Math.round((new Date(date).getTime() - Date.now()) / DAY);
}

export function isOverdue(inv: Pick<Invoice, "status" | "due_date">) {
  return inv.status !== "paid" && inv.status !== "cancelled" && daysUntil(inv.due_date) < 0;
}

export type DraftInvoice = {
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  issue_date: string;
  due_date: string;
  amount: number;
  notes: string;
};

const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "mail.ru"];

/** Rule-based fake / suspicious invoice detection. Returns 0-100 risk plus reasons. */
export function detectFraud(draft: DraftInvoice, existing: Invoice[]) {
  const flags: string[] = [];
  let score = 0;

  const number = draft.invoice_number.trim().toLowerCase();
  if (!number) {
    flags.push("Invoice number is missing");
    score += 20;
  } else if (existing.some((i) => i.invoice_number.trim().toLowerCase() === number)) {
    flags.push("Duplicate invoice number already in your records");
    score += 35;
  }

  const sameCustomer = existing.filter(
    (i) => i.customer_name.trim().toLowerCase() === draft.customer_name.trim().toLowerCase(),
  );
  const nearDuplicate = sameCustomer.find(
    (i) =>
      Math.abs(i.amount - draft.amount) < 0.01 &&
      Math.abs(daysBetween(i.issue_date, draft.issue_date)) <= 7,
  );
  if (nearDuplicate) {
    flags.push(`Near-duplicate of ${nearDuplicate.invoice_number} (same customer, same amount, within 7 days)`);
    score += 30;
  }

  const email = draft.customer_email.trim().toLowerCase();
  if (!email) {
    flags.push("No customer email to verify the billing contact");
    score += 10;
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    flags.push("Customer email is malformed");
    score += 20;
  } else {
    const domain = email.split("@")[1]!;
    if (FREE_MAIL.includes(domain) && draft.amount >= 5000) {
      flags.push("Large invoice billed to a free email domain");
      score += 15;
    }
    const known = sameCustomer.map((i) => (i.customer_email ?? "").toLowerCase().split("@")[1]).filter(Boolean);
    if (known.length && !known.includes(domain)) {
      flags.push("Email domain differs from previous invoices for this customer");
      score += 25;
    }
  }

  const term = daysBetween(draft.issue_date, draft.due_date);
  if (term < 0) {
    flags.push("Due date is before the issue date");
    score += 30;
  } else if (term === 0) {
    flags.push("Payment demanded same day — common pressure tactic");
    score += 15;
  } else if (term > 120) {
    flags.push("Unusually long payment term (over 120 days)");
    score += 10;
  }

  if (draft.amount <= 0) {
    flags.push("Amount is zero or negative");
    score += 25;
  } else {
    const paid = existing.filter((i) => i.amount > 0);
    const avg = paid.length ? paid.reduce((s, i) => s + i.amount, 0) / paid.length : 0;
    if (avg > 0 && draft.amount > avg * 5) {
      flags.push("Amount is more than 5x your typical invoice");
      score += 20;
    }
    if (draft.amount >= 10000 && draft.amount % 1000 === 0) {
      flags.push("Suspiciously round high-value amount");
      score += 10;
    }
  }

  if (daysUntil(draft.issue_date) > 1) {
    flags.push("Invoice is dated in the future");
    score += 15;
  }

  return { score: Math.max(0, Math.min(100, score)), flags };
}

/** Predicts the likelihood (0-100) that this invoice is paid late. */
export function predictLateRisk(draft: DraftInvoice, existing: Invoice[]) {
  const history = existing.filter(
    (i) => i.customer_name.trim().toLowerCase() === draft.customer_name.trim().toLowerCase(),
  );
  const settled = history.filter((i) => i.status === "paid" && i.paid_at);
  const lateCount = settled.filter((i) => daysBetween(i.due_date, i.paid_at!) > 0).length;
  const openOverdue = history.filter(isOverdue).length;

  let risk = 30;
  const reasons: string[] = [];

  if (settled.length) {
    const lateRate = lateCount / settled.length;
    risk = 15 + lateRate * 65;
    reasons.push(`${lateCount}/${settled.length} past invoices paid late`);
    const avgDelay =
      settled.reduce((s, i) => s + daysBetween(i.due_date, i.paid_at!), 0) / settled.length;
    if (avgDelay > 5) {
      risk += Math.min(15, avgDelay / 2);
      reasons.push(`Average settlement is ${Math.round(avgDelay)} days after the due date`);
    }
  } else {
    reasons.push("New customer — no payment history yet");
  }

  if (openOverdue) {
    risk += 15 * openOverdue;
    reasons.push(`${openOverdue} invoice(s) already overdue`);
  }

  const term = daysBetween(draft.issue_date, draft.due_date);
  if (term > 45) {
    risk += 8;
    reasons.push("Long payment terms drift more often");
  }
  if (draft.amount >= 10000) {
    risk += 8;
    reasons.push("High-value invoices clear more slowly");
  }

  return { risk: Math.max(0, Math.min(100, Math.round(risk))), reasons };
}

export type CustomerBehaviour = {
  customer: string;
  invoices: number;
  billed: number;
  paid: number;
  outstanding: number;
  avgDaysToPay: number | null;
  onTimeRate: number | null;
  overdue: number;
  rating: "Excellent" | "Reliable" | "Watch" | "Risky" | "Unknown";
};

export function analyzeCustomers(invoices: Invoice[]): CustomerBehaviour[] {
  const groups = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    const key = inv.customer_name.trim() || "Unnamed";
    groups.set(key, [...(groups.get(key) ?? []), inv]);
  }

  return [...groups.entries()]
    .map(([customer, list]) => {
      const settled = list.filter((i) => i.status === "paid" && i.paid_at);
      const delays = settled.map((i) => daysBetween(i.due_date, i.paid_at!));
      const avgDaysToPay = delays.length ? delays.reduce((s, d) => s + d, 0) / delays.length : null;
      const onTimeRate = delays.length ? delays.filter((d) => d <= 0).length / delays.length : null;
      const overdue = list.filter(isOverdue).length;
      const billed = list.reduce((s, i) => s + i.amount, 0);
      const paid = settled.reduce((s, i) => s + i.amount, 0);

      let rating: CustomerBehaviour["rating"] = "Unknown";
      if (onTimeRate !== null) {
        if (overdue > 0 || onTimeRate < 0.4) rating = "Risky";
        else if (onTimeRate < 0.7) rating = "Watch";
        else if (onTimeRate < 0.95) rating = "Reliable";
        else rating = "Excellent";
      } else if (overdue > 0) {
        rating = "Risky";
      }

      return {
        customer,
        invoices: list.length,
        billed,
        paid,
        outstanding: list.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0),
        avgDaysToPay,
        onTimeRate,
        overdue,
        rating,
      };
    })
    .sort((a, b) => b.billed - a.billed);
}

export function reminderMessage(inv: Invoice, sender: string) {
  const late = daysUntil(inv.due_date);
  const tone =
    late < 0
      ? `is now ${Math.abs(late)} day(s) overdue`
      : late === 0
        ? `is due today`
        : `is due in ${late} day(s)`;
  return `Hi ${inv.customer_name},

A friendly reminder that invoice ${inv.invoice_number} for ${inv.currency} ${inv.amount.toLocaleString()} ${tone} (due ${inv.due_date}).

If payment is already on its way, please ignore this note. Otherwise, a quick settlement would be much appreciated.

Thank you,
${sender}`;
}
