import * as dotenv from "dotenv";
dotenv.config();

import {
  FixedTokenAuthProvider,
  MonarchGraphQLClient,
  getTransactions as mmGetTransactions,
  getAccounts as mmGetAccounts,
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
