// Server dispatch integration tests — exercises the full createServer() → tool call path
// Uses InMemoryTransport to avoid network I/O; mocks monarch-money-ts API calls.

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
const { resetClients, setClientsForTesting } = require("../../src/api");
const { createServer } = require("../../src/server");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");

async function callTool(client, name, args = {}) {
  return client.callTool({ name, arguments: args });
}

async function setupServer() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

beforeEach(() => {
  resetClients();
  jest.clearAllMocks();
  process.env.MONARCH_TOKEN = "test-token";
  const mockAuth = { getToken: async () => "test-token", invalidate: async () => {} };
  setClientsForTesting(mockAuth, {});
});

afterEach(() => {
  delete process.env.MONARCH_TOKEN;
});

describe("Server dispatch: get_transactions", () => {
  test("returns formatted transaction text", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [
        { date: "2026-04-01", merchant: { name: "Costco" }, amount: 85.5, category: { name: "Groceries" }, account: { displayName: "Checking" } },
      ],
      totalCount: 1, totalSelectableCount: 1, transactionRuleIds: [],
    });

    const { client } = await setupServer();
    const result = await callTool(client, "get_transactions", { start_date: "2026-04-01", end_date: "2026-04-30" });

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain("Costco");
    expect(text).toContain("85.50");
    expect(text).toContain("Groceries");
  });

  test("returns no-transactions message for empty result", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [], totalCount: 0, totalSelectableCount: 0, transactionRuleIds: [],
    });

    const { client } = await setupServer();
    const result = await callTool(client, "get_transactions", { start_date: "2026-04-01", end_date: "2026-04-30" });

    expect(result.content[0].text).toContain("No transactions found");
  });
});

describe("Server dispatch: get_accounts", () => {
  test("returns account list", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      { id: "1", displayName: "Chase Checking", institution: { name: "Chase" }, type: { name: "checking" }, signedBalance: 4200, displayBalance: 4200 },
    ]);

    const { client } = await setupServer();
    const result = await callTool(client, "get_accounts");

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Chase Checking");
    expect(result.content[0].text).toContain("4200.00");
  });
});

describe("Server dispatch: get_balances", () => {
  test("returns net worth snapshot", async () => {
    monarchTs.getAccounts.mockResolvedValue([
      { id: "1", displayName: "Savings", institution: { name: "Chase" }, type: { name: "savings" }, signedBalance: 50000, displayBalance: 50000 },
      { id: "2", displayName: "Credit Card", institution: { name: "Amex" }, type: { name: "credit" }, signedBalance: -2000, displayBalance: 2000 },
    ]);

    const { client } = await setupServer();
    const result = await callTool(client, "get_balances");

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain("Net Worth");
    expect(text).toContain("50000.00");
    expect(text).toContain("2000.00");
  });
});

describe("Server dispatch: get_cashflow", () => {
  test("returns monthly cashflow summary", async () => {
    monarchTs.getTransactions.mockResolvedValue({
      transactions: [
        { date: "2026-03-10", merchant: { name: "Employer" }, amount: -4000, category: { name: "Income" }, account: { displayName: "Checking" } },
        { date: "2026-03-15", merchant: { name: "Rent" }, amount: 1500, category: { name: "Housing" }, account: { displayName: "Checking" } },
      ],
      totalCount: 2, totalSelectableCount: 2, transactionRuleIds: [],
    });

    const { client } = await setupServer();
    const result = await callTool(client, "get_cashflow", { months: 1 });

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain("Cashflow");
    expect(text).toContain("Income");
    expect(text).toContain("Expenses");
  });
});

describe("Server dispatch: unknown tool", () => {
  test("returns error for unknown tool name", async () => {
    const { client } = await setupServer();
    const result = await callTool(client, "nonexistent_tool");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });
});
