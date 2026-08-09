import type { BudgetInput } from "./finance";
import { analyzeBudget } from "./finance";

export interface FinancialHealthMetrics {
  score: number;
  grade: string;
  spendingAnalysis: SpendingAnalysis;
  debtHealth: DebtHealth;
  savingsHealth: SavingsHealth;
  recommendations: Recommendation[];
  summary: string;
}

export interface SpendingAnalysis {
  totalExpenses: number;
  expenseRatio: number;
  highestCategory: string;
  highestAmount: number;
  isBalanced: boolean;
  recommendation: string;
}

export interface DebtHealth {
  debtToIncomeRatio: number;
  riskLevel: "low" | "medium" | "high";
  monthlyDebtPayment: number;
  recommendation: string;
}

export interface SavingsHealth {
  savingsRate: number;
  monthlyAmount: number;
  emergencyFundCoverage: number;
  riskLevel: "at-risk" | "needs-improvement" | "healthy" | "excellent";
  recommendation: string;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impactArea: "spending" | "debt" | "savings";
}

export function calculateFinancialHealth(budget: BudgetInput): FinancialHealthMetrics {
  const analyzed = analyzeBudget(budget);

  const spending = calculateSpendingAnalysis(budget, analyzed);
  const debt = calculateDebtHealth(budget, analyzed);
  const savings = calculateSavingsHealth(budget, analyzed);
  const recommendations = generateRecommendations(analyzed, spending, debt, savings);

  // Overall score weighted average
  const debtScore = debt.riskLevel === "low" ? 30 : debt.riskLevel === "medium" ? 15 : 0;
  const savingsScore = getSavingsScore(savings.riskLevel);
  const spendingScore = spending.isBalanced ? 40 : 20;

  const score = Math.round(
    (analyzed.score * 0.3 + debtScore + savingsScore + spendingScore) / 1.3
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    grade: getGrade(score),
    spendingAnalysis: spending,
    debtHealth: debt,
    savingsHealth: savings,
    recommendations,
    summary: generateSummary(analyzed, spending, debt, savings),
  };
}

function calculateSpendingAnalysis(
  budget: BudgetInput,
  analyzed: ReturnType<typeof analyzeBudget>
): SpendingAnalysis {
  const expenses = analyzed.expenses;
  const expenseRatio = budget.income > 0 ? (expenses / budget.income) * 100 : 0;

  const categories = [
    { name: "Housing", amount: budget.housing },
    { name: "Food", amount: budget.food },
    { name: "Transport", amount: budget.transport },
    { name: "Utilities", amount: budget.utilities },
    { name: "Debt", amount: budget.debt },
    { name: "Lifestyle", amount: budget.lifestyle },
    { name: "Other", amount: budget.other },
  ].sort((a, b) => b.amount - a.amount);

  const highest = categories[0];
  const isBalanced = expenseRatio <= 85 && budget.housing / budget.income <= 0.3;

  return {
    totalExpenses: expenses,
    expenseRatio,
    highestCategory: highest?.name ?? "None",
    highestAmount: highest?.amount ?? 0,
    isBalanced,
    recommendation: isBalanced
      ? "Your spending is well-balanced. Maintain this discipline."
      : expenseRatio > 90
        ? "Your expenses exceed 90% of income. Consider reducing discretionary spending."
        : "Your spending ratio is moderate. Look for optimization opportunities.",
  };
}

function calculateDebtHealth(
  budget: BudgetInput,
  analyzed: ReturnType<typeof analyzeBudget>
): DebtHealth {
  const dti = analyzed.debtRatio;
  const riskLevel = dti <= 15 ? "low" : dti <= 30 ? "medium" : "high";

  return {
    debtToIncomeRatio: dti,
    riskLevel,
    monthlyDebtPayment: budget.debt,
    recommendation:
      riskLevel === "low"
        ? "Excellent debt management. Your debt is well under control."
        : riskLevel === "medium"
          ? "Your debt is manageable but consider accelerating payments to reduce risk."
          : "High debt burden. Focus on debt reduction as a priority.",
  };
}

function calculateSavingsHealth(
  budget: BudgetInput,
  analyzed: ReturnType<typeof analyzeBudget>
): SavingsHealth {
  const savingsRate = analyzed.savingsRate;
  const riskLevel =
    savingsRate >= 20
      ? "excellent"
      : savingsRate >= 10
        ? "healthy"
        : savingsRate >= 5
          ? "needs-improvement"
          : "at-risk";

  const emergencyFundMonths = analyzed.monthsToEmergency;
  const emergencyFundCoverage = Number.isFinite(emergencyFundMonths)
    ? Math.round(emergencyFundMonths)
    : 0;

  return {
    savingsRate,
    monthlyAmount: analyzed.surplus,
    emergencyFundCoverage,
    riskLevel,
    recommendation:
      riskLevel === "excellent"
        ? "Outstanding savings rate. You're building wealth effectively."
        : riskLevel === "healthy"
          ? "Good savings discipline. Continue this trajectory."
          : riskLevel === "needs-improvement"
            ? "Increase savings rate. Aim for at least 10% of income."
            : "Critical: You're not saving. Reduce expenses to create a buffer.",
  };
}

function getSavingsScore(level: SavingsHealth["riskLevel"]): number {
  switch (level) {
    case "excellent":
      return 40;
    case "healthy":
      return 30;
    case "needs-improvement":
      return 15;
    case "at-risk":
      return 0;
  }
}

function getGrade(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Fair";
  return "At Risk";
}

function generateRecommendations(
  analyzed: ReturnType<typeof analyzeBudget>,
  spending: SpendingAnalysis,
  debt: DebtHealth,
  savings: SavingsHealth
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Debt recommendations
  if (debt.riskLevel === "high") {
    recs.push({
      priority: "high",
      title: "Reduce Debt Urgently",
      description: `Your debt-to-income ratio of ${debt.debtToIncomeRatio.toFixed(1)}% is too high. Aim to reduce it below 15%.`,
      impactArea: "debt",
    });
  }

  // Savings recommendations
  if (savings.riskLevel === "at-risk") {
    recs.push({
      priority: "high",
      title: "Create Emergency Fund",
      description: "You have no monthly surplus. Cut expenses to create a savings buffer.",
      impactArea: "savings",
    });
  } else if (savings.emergencyFundCoverage < 3) {
    recs.push({
      priority: "high",
      title: "Build Emergency Fund",
      description: `You have ${savings.emergencyFundCoverage} months of expenses saved. Target 6 months.`,
      impactArea: "savings",
    });
  }

  // Spending recommendations
  if (spending.expenseRatio > 90) {
    recs.push({
      priority: "high",
      title: `Reduce ${spending.highestCategory} Spending`,
      description: `${spending.highestCategory} is your largest expense. Finding even a 10% reduction could improve your health score significantly.`,
      impactArea: "spending",
    });
  }

  if (analyzed.housingRatio > 30) {
    recs.push({
      priority: "medium",
      title: "Optimize Housing Costs",
      description: `Housing is ${analyzed.housingRatio.toFixed(1)}% of income (target: ≤30%). Consider finding more affordable accommodation.`,
      impactArea: "spending",
    });
  }

  // General wellness
  if (analyzed.surplus <= 0) {
    recs.push({
      priority: "high",
      title: "Address Deficit Spending",
      description: "You're spending more than you earn. Immediate expense reduction is critical.",
      impactArea: "spending",
    });
  } else if (savings.savingsRate < 10) {
    recs.push({
      priority: "medium",
      title: "Increase Savings Rate",
      description: "Aim to save at least 10% of your income. Review discretionary spending.",
      impactArea: "savings",
    });
  }

  // If all is good
  if (recs.length === 0) {
    recs.push({
      priority: "low",
      title: "Maintain Current Habits",
      description: "You're doing well. Keep maintaining your current financial discipline.",
      impactArea: "savings",
    });
  }

  return recs.slice(0, 3); // Return top 3
}

function generateSummary(
  analyzed: ReturnType<typeof analyzeBudget>,
  spending: SpendingAnalysis,
  debt: DebtHealth,
  savings: SavingsHealth
): string {
  const grade = getGrade(analyzed.score);

  if (analyzed.score >= 85) {
    return `Your financial health is ${grade}. You're in excellent shape with strong savings, manageable debt, and balanced spending. Continue your current approach.`;
  }

  if (analyzed.score >= 70) {
    return `Your financial health is ${grade}. You have a solid foundation but can improve by focusing on ${savings.riskLevel === "at-risk" ? "building savings" : "reducing debt"}.`;
  }

  if (analyzed.score >= 50) {
    return `Your financial health is ${grade}. You need to address critical areas: focus on creating a surplus and reducing ${debt.riskLevel === "high" ? "debt" : "expenses"}.`;
  }

  return `Your financial health is at ${grade} risk. You're spending more than you earn. Immediate expense reduction and income increase are critical priorities.`;
}
