export const currency = (n: number, fraction = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fraction,
    minimumFractionDigits: fraction,
  }).format(Number.isFinite(n) ? n : 0);

export const pct = (n: number, d = 1) => `${(Number.isFinite(n) ? n : 0).toFixed(d)}%`;

export const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Equated monthly installment */
export function emi(principal: number, annualRate: number, years: number) {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

export type BudgetInput = {
  income: number;
  housing: number;
  food: number;
  transport: number;
  utilities: number;
  debt: number;
  lifestyle: number;
  other: number;
  savingsTarget: number;
};

export function analyzeBudget(b: BudgetInput) {
  const expenses = b.housing + b.food + b.transport + b.utilities + b.debt + b.lifestyle + b.other;
  const surplus = b.income - expenses;
  const savingsRate = b.income > 0 ? (surplus / b.income) * 100 : 0;
  const housingRatio = b.income > 0 ? (b.housing / b.income) * 100 : 0;
  const debtRatio = b.income > 0 ? (b.debt / b.income) * 100 : 0;

  let score = 0;
  score += Math.max(0, Math.min(40, (savingsRate / 20) * 40));
  score += housingRatio <= 30 ? 25 : Math.max(0, 25 - (housingRatio - 30));
  score += debtRatio <= 15 ? 20 : Math.max(0, 20 - (debtRatio - 15) * 1.5);
  score += surplus >= 0 ? 15 : 0;
  score = Math.round(Math.max(0, Math.min(100, score)));

  const grade =
    score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 50 ? "Fair" : "At risk";

  const emergencyTarget = expenses * 6;
  const monthlyToEmergency = Math.max(surplus, b.savingsTarget);
  const monthsToEmergency =
    monthlyToEmergency > 0 ? Math.ceil(emergencyTarget / monthlyToEmergency) : Infinity;

  const breakdown = [
    { name: "Housing", value: b.housing },
    { name: "Food", value: b.food },
    { name: "Transport", value: b.transport },
    { name: "Utilities", value: b.utilities },
    { name: "Debt", value: b.debt },
    { name: "Lifestyle", value: b.lifestyle },
    { name: "Other", value: b.other },
  ].filter((d) => d.value > 0);

  return {
    expenses,
    surplus,
    savingsRate,
    housingRatio,
    debtRatio,
    score,
    grade,
    emergencyTarget,
    monthsToEmergency,
    breakdown,
  };
}

export type Bank = {
  id: string;
  name: string;
  amount: number;
  rate: number;
  years: number;
  fees: number;
};

export function evaluateLoan(bank: Bank) {
  const monthly = emi(bank.amount, bank.rate, bank.years);
  const totalRepayment = monthly * bank.years * 12 + bank.fees;
  const totalInterest = totalRepayment - bank.amount;
  return { monthly, totalRepayment, totalInterest };
}

export type CashflowMonth = {
  id: string;
  month: string;
  revenue: number;
  cogs: number;
  opex: number;
};

export function analyzeCashflow(months: CashflowMonth[], openingCash: number) {
  let cash = openingCash;
  const rows = months.map((m) => {
    const gross = m.revenue - m.cogs;
    const net = gross - m.opex;
    cash += net;
    return { ...m, gross, net, cash };
  });
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const expenses = rows.reduce((s, r) => s + r.cogs + r.opex, 0);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const avgBurn = rows.length ? expenses / rows.length : 0;
  const closing = rows.length ? rows[rows.length - 1].cash : openingCash;
  const avgNet = rows.length ? profit / rows.length : 0;
  const runway = avgNet < 0 ? closing / Math.abs(avgNet) : Infinity;
  return { rows, revenue, expenses, profit, margin, avgBurn, closing, runway };
}

export type ClientInput = {
  name: string;
  monthlyIncome: number;
  existingDebt: number;
  requestedAmount: number;
  rate: number;
  years: number;
  creditScore: number;
  yearsInBusiness: number;
};

export function adviseClient(c: ClientInput) {
  const newEmi = emi(c.requestedAmount, c.rate, c.years);
  const dti = c.monthlyIncome > 0 ? ((c.existingDebt + newEmi) / c.monthlyIncome) * 100 : 100;
  const disposable = c.monthlyIncome - c.existingDebt - newEmi;
  const coverage = newEmi > 0 ? (c.monthlyIncome - c.existingDebt) / newEmi : 0;

  let score = 0;
  score += dti <= 35 ? 35 : Math.max(0, 35 - (dti - 35) * 1.2);
  score += Math.max(0, Math.min(30, ((c.creditScore - 500) / 350) * 30));
  score += Math.max(0, Math.min(20, coverage * 10));
  score += Math.max(0, Math.min(15, c.yearsInBusiness * 3));
  score = Math.round(Math.max(0, Math.min(100, score)));

  const decision =
    score >= 75 && disposable > 0
      ? "Approve"
      : score >= 55 && disposable > 0
        ? "Approve with conditions"
        : "Decline";

  const safeAmount = (() => {
    const capacity = Math.max(0, c.monthlyIncome * 0.35 - c.existingDebt);
    const r = c.rate / 100 / 12;
    const n = Math.round(c.years * 12);
    if (capacity <= 0 || n <= 0) return 0;
    if (r === 0) return capacity * n;
    const f = Math.pow(1 + r, n);
    return (capacity * (f - 1)) / (r * f);
  })();

  return { newEmi, dti, disposable, coverage, score, decision, safeAmount };
}
