// Unit tests for claude-monarch MCP tools
// Mocks the monarch-money-ts functional API.

jest.mock("monarch-money-ts", () => {
  const mockGetTransactions = jest.fn();
  const mockGetAccounts = jest.fn();

  return {
    FixedTokenAuthProvider: jest.fn().mockImplementation((token) => ({
      getToken: async () => token,
      invalidate: async () => {},
    })),
    MonarchGraphQLClient: jest.fn().mockImplementation(() => ({})),
    getTransactions: mockGetTransactions,
    getAccounts: mockGetAccounts,
  };
});

const monarchTs = require("monarch-money-ts");
const { resetClients, setClientsForTesting, getTransactions, getAccounts, getNetWorth, getCashflow } =
  require("../../src/api");

beforeEach(() => {
  resetClients();
  jest.clearAllMocks();
  // Inject mock auth + client so MONARCH_TOKEN env var isn't required
  const mockAuth = { getToken: async () => "test-token", invalidate: async () => {} };
  const mockGraphQL = {};
  setClientsForTesting(mockAuth, mockGraphQL);
});

// ─── get_transactions ───────────────────────────────────────────────────────

describe("getTransactions", () => {
  test("returns formatted transaction list", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [
        {
          date: "2026-01-15",
          merchant: { name: "Whole Foods" },
          plaidName: "WHOLEFDS",
          amount: -42.5,
          category: { name: "Groceries" },
          account: { displayName: "Checking" },
        },
        {
          date: "2026-01-20",
          merchant: { name: "Netflix" },
          plaidName: "NETFLIX",
          amount: -15.99,
          category: { name: "Entertainment" },
          account: { displayName: "Chase Visa" },
        },
      ],
      totalCount: 2,
      totalSelectableCount: 2,
      transactionRuleIds: [],
    });

    const result = await getTransactions({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      limit: 50,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-01-15",
      merchant: "Whole Foods",
      amount: -42.5,
      category: "Groceries",
      account_name: "Checking",
    });
    expect(result[1].merchant).toBe("Netflix");
  });

  test("passes account_id as accountIds filter", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [],
      totalCount: 0,
      totalSelectableCount: 0,
      transactionRuleIds: [],
    });

    await getTransactions({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      account_id: "acct_abc123",
    });

    const callArgs = monarchTs.getTransactions.mock.calls[0][2];
    expect(callArgs.filters.accountIds).toEqual(["acct_abc123"]);
  });

  test("returns empty array when API returns no transactions", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [],
      totalCount: 0,
      totalSelectableCount: 0,
      transactionRuleIds: [],
    });

    const result = await getTransactions({
      start_date: "2026-01-01",
      end_date: "2026-01-31",
    });

    expect(result).toEqual([]);
  });
});

// ─── get_accounts ───────────────────────────────────────────────────────────

describe("getAccounts", () => {
  test("returns formatted account list", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      {
        id: "1",
        displayName: "Primary Checking",
        institution: { name: "Chase" },
        type: { name: "checking", display: "Checking" },
        signedBalance: 5400.0,
        displayBalance: 5400.0,
      },
      {
        id: "2",
        displayName: "Fidelity Brokerage",
        institution: { name: "Fidelity" },
        type: { name: "investment", display: "Investment" },
        signedBalance: 82000.0,
        displayBalance: 82000.0,
      },
    ]);

    const result = await getAccounts();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "1",
      name: "Primary Checking",
      institution: "Chase",
      type: "checking",
      balance: 5400.0,
    });
    expect(result[1].balance).toBe(82000.0);
  });
});

// ─── get_balances ───────────────────────────────────────────────────────────

describe("getNetWorth", () => {
  test("returns net worth snapshot with assets, liabilities, and top 5 accounts", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      { id: "1", displayName: "Savings", institution: { name: "Chase" }, type: { name: "savings" }, signedBalance: 20000, displayBalance: 20000 },
      { id: "2", displayName: "401k", institution: { name: "Fidelity" }, type: { name: "investment" }, signedBalance: 100000, displayBalance: 100000 },
      { id: "3", displayName: "Credit Card", institution: { name: "Amex" }, type: { name: "credit" }, signedBalance: -3000, displayBalance: 3000 },
      { id: "4", displayName: "Checking", institution: { name: "Chase" }, type: { name: "checking" }, signedBalance: 5000, displayBalance: 5000 },
      { id: "5", displayName: "Car Loan", institution: { name: "Toyota" }, type: { name: "loan" }, signedBalance: -15000, displayBalance: 15000 },
      { id: "6", displayName: "HSA", institution: { name: "Optum" }, type: { name: "savings" }, signedBalance: 2500, displayBalance: 2500 },
    ]);

    const result = await getNetWorth();

    expect(result.assets).toBe(127500);    // 20000+100000+5000+2500
    expect(result.liabilities).toBe(18000); // 3000+15000
    expect(result.net_worth).toBe(109500);
    expect(result.top_accounts).toHaveLength(5);
    expect(result.top_accounts[0].name).toBe("401k");
  });

  test("correctly computes zero liabilities when all balances are positive", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      { id: "1", displayName: "Savings", institution: { name: "Chase" }, type: { name: "savings" }, signedBalance: 10000, displayBalance: 10000 },
      { id: "2", displayName: "Checking", institution: { name: "Chase" }, type: { name: "checking" }, signedBalance: 2000, displayBalance: 2000 },
    ]);

    const result = await getNetWorth();

    expect(result.liabilities).toBe(0);
    expect(result.assets).toBe(12000);
    expect(result.net_worth).toBe(12000);
  });
});

// ─── get_cashflow ───────────────────────────────────────────────────────────

describe("getCashflow", () => {
  test("groups transactions by month and splits income vs expenses", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [
        // January expenses (positive = expense)
        { date: "2026-01-05", merchant: { name: "Grocery" }, amount: 120, category: { name: "Food" }, account: { displayName: "Checking" } },
        { date: "2026-01-20", merchant: { name: "Rent" }, amount: 2000, category: { name: "Housing" }, account: { displayName: "Checking" } },
        // January income (negative = credit/income)
        { date: "2026-01-15", merchant: { name: "Employer" }, amount: -5000, category: { name: "Income" }, account: { displayName: "Checking" } },
        // February expenses
        { date: "2026-02-03", merchant: { name: "Grocery" }, amount: 150, category: { name: "Food" }, account: { displayName: "Checking" } },
      ],
      totalCount: 4,
      totalSelectableCount: 4,
      transactionRuleIds: [],
    });

    const result = await getCashflow(3);

    expect(result).toHaveLength(2);
    const jan = result.find((m) => m.month === "2026-01");
    const feb = result.find((m) => m.month === "2026-02");

    expect(jan).toBeDefined();
    expect(jan.income).toBe(5000);
    expect(jan.expenses).toBe(2120);
    expect(jan.net).toBe(2880);

    expect(feb).toBeDefined();
    expect(feb.expenses).toBe(150);
    expect(feb.net).toBe(-150);
  });

  test("returns empty array when no transactions", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [],
      totalCount: 0,
      totalSelectableCount: 0,
      transactionRuleIds: [],
    });

    const result = await getCashflow(1);
    expect(result).toEqual([]);
  });
});
