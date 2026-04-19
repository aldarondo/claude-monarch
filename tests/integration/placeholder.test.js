// Integration tests for claude-monarch MCP server tools
// Exercises the api.ts layer with mocked monarch-money-ts calls.

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
const { resetClients, setClientsForTesting, getTransactions, getAccounts, getNetWorth } =
  require("../../src/api");

beforeEach(() => {
  resetClients();
  jest.clearAllMocks();
  const mockAuth = { getToken: async () => "test-token", invalidate: async () => {} };
  const mockGraphQL = {};
  setClientsForTesting(mockAuth, mockGraphQL);
});

describe("Integration: api layer with mocked monarch-money-ts", () => {
  test("get_transactions returns correctly shaped objects", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [
        {
          date: "2026-03-01",
          merchant: { name: "Trader Joe's" },
          plaidName: "TJ",
          amount: -31.5,
          category: { name: "Groceries" },
          account: { displayName: "Checking" },
        },
      ],
      totalCount: 1,
      totalSelectableCount: 1,
      transactionRuleIds: [],
    });

    const result = await getTransactions({
      start_date: "2026-03-01",
      end_date: "2026-03-31",
    });

    expect(result[0].merchant).toBe("Trader Joe's");
    expect(result[0].date).toBe("2026-03-01");
    expect(result[0].amount).toBe(-31.5);
    expect(result[0].category).toBe("Groceries");
    expect(result[0].account_name).toBe("Checking");
  });

  test("get_accounts returns all linked accounts with correct fields", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      {
        id: "a1",
        displayName: "Chase Checking",
        institution: { name: "Chase" },
        type: { name: "checking" },
        signedBalance: 3200,
        displayBalance: 3200,
      },
      {
        id: "a2",
        displayName: "Roth IRA",
        institution: { name: "Vanguard" },
        type: { name: "investment" },
        signedBalance: 45000,
        displayBalance: 45000,
      },
    ]);

    const result = await getAccounts();

    expect(result).toHaveLength(2);
    expect(result.find((a) => a.name === "Roth IRA")).toBeTruthy();
    expect(result.find((a) => a.institution === "Chase")).toBeTruthy();
  });

  test("get_balances net_worth equals assets minus liabilities", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      { id: "1", displayName: "Brokerage", institution: { name: "Schwab" }, type: { name: "investment" }, signedBalance: 150000, displayBalance: 150000 },
      { id: "2", displayName: "Mortgage", institution: { name: "Wells Fargo" }, type: { name: "loan" }, signedBalance: -45000, displayBalance: 45000 },
      { id: "3", displayName: "Savings", institution: { name: "Chase" }, type: { name: "savings" }, signedBalance: 25000, displayBalance: 25000 },
    ]);

    const result = await getNetWorth();

    expect(result.assets).toBe(175000);
    expect(result.liabilities).toBe(45000);
    expect(result.net_worth).toBe(130000);
    expect(result.top_accounts[0].name).toBe("Brokerage");
  });
});
