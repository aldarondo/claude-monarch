// Unit tests for getBudgets API function + get_budgets server tool dispatch

jest.mock("monarch-money-ts", () => {
  return {
    FixedTokenAuthProvider: jest.fn().mockImplementation((token) => ({
      getToken: async () => token,
      invalidate: async () => {},
    })),
    MonarchGraphQLClient: jest.fn().mockImplementation(() => ({})),
    getTransactions: jest.fn(),
    getAccounts: jest.fn(),
    getBudgetReport: jest.fn(),
  };
});

const monarchTs = require("monarch-money-ts");
const { resetClients, setClientsForTesting } = require("../../src/api");
const { createServer } = require("../../src/server");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");

function makeBudgetReport({ month = "2026-04", planned = 1500, actual = 1200 } = {}) {
  return {
    budgetSystem: "groups_and_categories",
    categoryGroups: [
      {
        id: "grp-income",
        name: "Income",
        type: "income",
        order: 0,
        budgetVariability: null,
        groupLevelBudgetingEnabled: false,
        updatedAt: "2026-04-01",
        categories: [
          {
            id: "cat-salary",
            name: "Salary",
            icon: "💼",
            order: 0,
            budgetVariability: null,
            excludeFromBudget: false,
            isSystemCategory: false,
            updatedAt: "2026-04-01",
            group: { id: "grp-income", type: "income", budgetVariability: null, groupLevelBudgetingEnabled: false },
            rolloverPeriod: null,
          },
        ],
      },
      {
        id: "grp-expense",
        name: "Living Expenses",
        type: "expense",
        order: 1,
        budgetVariability: "fixed",
        groupLevelBudgetingEnabled: false,
        updatedAt: "2026-04-01",
        categories: [
          {
            id: "cat-groceries",
            name: "Groceries",
            icon: "🛒",
            order: 0,
            budgetVariability: "fixed",
            excludeFromBudget: false,
            isSystemCategory: false,
            updatedAt: "2026-04-01",
            group: { id: "grp-expense", type: "expense", budgetVariability: "fixed", groupLevelBudgetingEnabled: false },
            rolloverPeriod: null,
          },
        ],
      },
    ],
    budgetData: {
      monthlyAmountsByCategory: [
        {
          category: { id: "cat-salary" },
          monthlyAmounts: [
            {
              month: `${month}-01`,
              plannedCashFlowAmount: planned,
              plannedSetAsideAmount: null,
              actualAmount: actual,
              remainingAmount: planned - actual,
              previousMonthRolloverAmount: null,
              rolloverType: null,
              cumulativeActualAmount: actual,
              rolloverTargetAmount: null,
            },
          ],
        },
        {
          category: { id: "cat-groceries" },
          monthlyAmounts: [
            {
              month: `${month}-01`,
              plannedCashFlowAmount: 400,
              plannedSetAsideAmount: null,
              actualAmount: 350,
              remainingAmount: 50,
              previousMonthRolloverAmount: null,
              rolloverType: null,
              cumulativeActualAmount: 350,
              rolloverTargetAmount: null,
            },
          ],
        },
      ],
      monthlyAmountsByCategoryGroup: [],
    },
    goalsV2: [],
    goalMonthlyContributions: [],
  };
}

async function setupServer() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client };
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

describe("get_budgets tool dispatch", () => {
  test("returns budget vs actual for specified month", async () => {
    monarchTs.getBudgetReport.mockResolvedValue(makeBudgetReport({ month: "2026-04", planned: 5000, actual: 4200 }));

    const { client } = await setupServer();
    const result = await client.callTool({ name: "get_budgets", arguments: { month: "2026-04" } });

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain("2026-04");
    expect(text).toContain("Income");
    expect(text).toContain("Salary");
    expect(text).toContain("Groceries");
    expect(text).toContain("planned");
  });

  test("uses current month when month not specified", async () => {
    monarchTs.getBudgetReport.mockResolvedValue(makeBudgetReport());

    const { client } = await setupServer();
    const result = await client.callTool({ name: "get_budgets", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(monarchTs.getBudgetReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ startDate: expect.stringMatching(/^\d{4}-\d{2}-01$/) })
    );
  });

  test("returns error message on API failure", async () => {
    monarchTs.getBudgetReport.mockRejectedValue(new Error("API unavailable"));

    const { client } = await setupServer();
    const result = await client.callTool({ name: "get_budgets", arguments: { month: "2026-04" } });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("API unavailable");
  });

  test("skips transfer-type groups in output", async () => {
    const report = makeBudgetReport();
    report.categoryGroups.push({
      id: "grp-transfer",
      name: "Transfers",
      type: "transfer",
      order: 2,
      budgetVariability: null,
      groupLevelBudgetingEnabled: false,
      updatedAt: "2026-04-01",
      categories: [],
    });
    monarchTs.getBudgetReport.mockResolvedValue(report);

    const { client } = await setupServer();
    const result = await client.callTool({ name: "get_budgets", arguments: { month: "2026-04" } });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).not.toContain("Transfers");
  });

  test("shows remaining amount correctly", async () => {
    monarchTs.getBudgetReport.mockResolvedValue(makeBudgetReport({ month: "2026-04", planned: 1500, actual: 1200 }));

    const { client } = await setupServer();
    const result = await client.callTool({ name: "get_budgets", arguments: { month: "2026-04" } });

    const text = result.content[0].text;
    expect(text).toContain("remaining");
    expect(text).toContain("300.00"); // 1500 - 1200
  });
});
