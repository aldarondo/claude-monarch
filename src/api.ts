import * as dotenv from "dotenv";
dotenv.config();

import {
  FixedTokenAuthProvider,
  MonarchGraphQLClient,
  getTransactions as mmGetTransactions,
  getAccounts as mmGetAccounts,
  getBudgetReport as mmGetBudgetReport,
  type AuthProvider,
} from "monarch-money-ts";

export interface Transaction {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  account_name: string;
}

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
}

export interface MonthlyCashflow {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface BalanceSnapshot {
  assets: number;
  liabilities: number;
  net_worth: number;
  top_accounts: Array<{ name: string; balance: number; type: string }>;
}

export interface GetTransactionsOptions {
  start_date: string;
  end_date: string;
  limit?: number;
  account_id?: string;
}

// ── Internal state (injectable for testing) ──────────────────────────────────

let _auth: AuthProvider | null = null;
let _graphql: MonarchGraphQLClient | null = null;

function getAuth(): AuthProvider {
  if (_auth) return _auth;
  const token = process.env.MONARCH_TOKEN;
  if (!token) {
    throw new Error(
      "MONARCH_TOKEN environment variable is required. " +
        "Set it to your Monarch Money session token."
    );
  }
  _auth = new FixedTokenAuthProvider(token);
  return _auth;
}

function getGraphQL(): MonarchGraphQLClient {
  if (_graphql) return _graphql;
  _graphql = new MonarchGraphQLClient();
  return _graphql;
}

/** Exposed for testing — allows injecting mock auth + graphql client */
export function setClientsForTesting(
  auth: AuthProvider,
  graphql: MonarchGraphQLClient
): void {
  _auth = auth;
  _graphql = graphql;
}

export function resetClients(): void {
  _auth = null;
  _graphql = null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTransactions(
  opts: GetTransactionsOptions
): Promise<Transaction[]> {
  const auth = getAuth();
  const graphql = getGraphQL();

  const filters: Record<string, unknown> = {
    startDate: opts.start_date,
    endDate: opts.end_date,
  };
  if (opts.account_id) {
    filters.accountIds = [opts.account_id];
  }

  const result = await mmGetTransactions(auth, graphql, {
    limit: opts.limit ?? 50,
    filters,
  });

  return result.transactions.map((t) => ({
    date: t.date,
    merchant: t.merchant?.name ?? t.plaidName ?? "",
    amount: t.amount,
    category: t.category?.name ?? "Uncategorized",
    account_name: t.account?.displayName ?? "",
  }));
}

export async function getAccounts(): Promise<Account[]> {
  const auth = getAuth();
  const graphql = getGraphQL();

  const accounts = await mmGetAccounts(auth, graphql);

  return accounts.map((a) => ({
    id: a.id,
    name: a.displayName,
    institution: a.institution?.name ?? "",
    type: a.type?.name ?? "unknown",
    balance: a.signedBalance ?? a.displayBalance ?? 0,
  }));
}

/**
 * Derive monthly cashflow from transactions for the past N months.
 * Income = positive amounts, Expenses = absolute value of negative amounts.
 */
export async function getCashflow(months: number = 3): Promise<MonthlyCashflow[]> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - months);

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const txns = await getTransactions({
    start_date: fmt(startDate),
    end_date: fmt(endDate),
    limit: 500,
  });

  const byMonth: Map<string, { income: number; expenses: number }> = new Map();

  for (const t of txns) {
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(month)) byMonth.set(month, { income: 0, expenses: 0 });
    const bucket = byMonth.get(month)!;
    // Monarch Money convention: positive = expense, negative = income (credit)
    // but this varies by account type. Treat positive as expense, negative as income.
    if (t.amount > 0) {
      bucket.expenses += t.amount;
    } else {
      bucket.income += Math.abs(t.amount);
    }
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income, expenses }]) => ({
      month,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    }));
}

export async function getNetWorth(): Promise<BalanceSnapshot> {
  const accounts = await getAccounts();

  let assets = 0;
  let liabilities = 0;

  for (const acct of accounts) {
    if (acct.balance >= 0) {
      assets += acct.balance;
    } else {
      liabilities += Math.abs(acct.balance);
    }
  }

  const top_accounts = [...accounts]
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5)
    .map((a) => ({ name: a.name, balance: a.balance, type: a.type }));

  return {
    assets,
    liabilities,
    net_worth: assets - liabilities,
    top_accounts,
  };
}

// ── Budget vs actual ──────────────────────────────────────────────────────────

export interface BudgetCategoryRow {
  name: string;
  planned: number;
  actual: number;
  remaining: number;
}

export interface BudgetGroupRow {
  name: string;
  type: "income" | "expense" | "transfer";
  planned: number;
  actual: number;
  remaining: number;
  categories: BudgetCategoryRow[];
}

export interface BudgetComparison {
  month: string;
  groups: BudgetGroupRow[];
}

/**
 * Budget vs actual comparison for a given month (YYYY-MM).
 * Defaults to the current month if omitted.
 */
export async function getBudgets(month?: string): Promise<BudgetComparison> {
  const auth = getAuth();
  const graphql = getGraphQL();

  const targetMonth = month ?? new Date().toISOString().slice(0, 7);
  const [year, mo] = targetMonth.split("-").map(Number);
  const startDate = `${targetMonth}-01`;
  const lastDay = new Date(year, mo, 0).getDate();
  const endDate = `${targetMonth}-${String(lastDay).padStart(2, "0")}`;

  const report = await mmGetBudgetReport(auth, graphql, { startDate, endDate });

  // Build category id → name map from categoryGroups
  const catNameById = new Map<string, string>();
  for (const grp of report.categoryGroups) {
    for (const cat of grp.categories) {
      catNameById.set(cat.id, cat.name);
    }
  }

  // Build category id → monthly amounts map
  const catAmountsById = new Map<
    string,
    { planned: number; actual: number; remaining: number }
  >();
  for (const entry of report.budgetData.monthlyAmountsByCategory) {
    const amounts = entry.monthlyAmounts.find((m) => m.month.startsWith(targetMonth));
    if (amounts) {
      catAmountsById.set(entry.category.id, {
        planned: amounts.plannedCashFlowAmount,
        actual: amounts.actualAmount,
        remaining: amounts.remainingAmount,
      });
    }
  }

  const groups: BudgetGroupRow[] = report.categoryGroups.map((grp) => {
    const categories: BudgetCategoryRow[] = grp.categories
      .filter((cat) => !cat.excludeFromBudget)
      .map((cat) => {
        const a = catAmountsById.get(cat.id) ?? { planned: 0, actual: 0, remaining: 0 };
        return { name: catNameById.get(cat.id) ?? cat.id, ...a };
      })
      .filter((c) => c.planned !== 0 || c.actual !== 0);

    const planned  = categories.reduce((s, c) => s + c.planned, 0);
    const actual   = categories.reduce((s, c) => s + c.actual, 0);
    const remaining = categories.reduce((s, c) => s + c.remaining, 0);

    return {
      name: grp.name,
      type: grp.type,
      planned:   Math.round(planned   * 100) / 100,
      actual:    Math.round(actual    * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      categories,
    };
  });

  return { month: targetMonth, groups };
}
