import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getTransactions, getAccounts, getNetWorth, getCashflow, getBudgets } from "./api.js";

export function createServer(): Server {
  const server = new Server(
    { name: "claude-monarch", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  // ── List tools ───────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_transactions",
        description:
          "Query Monarch Money transactions by date range. Optionally filter by account ID.",
        inputSchema: {
          type: "object",
          properties: {
            start_date: {
              type: "string",
              description: "Start date in YYYY-MM-DD format (inclusive)",
            },
            end_date: {
              type: "string",
              description: "End date in YYYY-MM-DD format (inclusive)",
            },
            limit: {
              type: "number",
              description: "Maximum number of transactions to return (default 50)",
            },
            account_id: {
              type: "string",
              description: "Optional Monarch Money account ID to filter by",
            },
          },
          required: ["start_date", "end_date"],
        },
      },
      {
        name: "get_accounts",
        description:
          "List all linked financial accounts with name, institution, type, and current balance.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_balances",
        description:
          "Return a net worth snapshot: total assets, liabilities, net total, and top 5 accounts by absolute value.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_cashflow",
        description:
          "Get monthly income vs expenses for the past N months, derived from transactions. " +
          "Returns per-month breakdown with net savings.",
        inputSchema: {
          type: "object",
          properties: {
            months: {
              type: "number",
              description: "Number of months to look back (default 3)",
            },
          },
          required: [],
        },
      },
      {
        name: "get_budgets",
        description:
          "Compare budgeted amounts vs actual spending for a given month. " +
          "Returns income and expense category groups with planned, actual, and remaining amounts.",
        inputSchema: {
          type: "object",
          properties: {
            month: {
              type: "string",
              description: "Month in YYYY-MM format (default: current month)",
            },
          },
          required: [],
        },
      },
    ],
  }));

  // ── Handle tool calls ────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case "get_transactions": {
          const start_date = String(args.start_date ?? "");
          const end_date = String(args.end_date ?? "");
          if (!start_date || !end_date) {
            throw new Error("start_date and end_date are required");
          }
          const limit =
            args.limit !== undefined ? Number(args.limit) : 50;
          const account_id =
            args.account_id !== undefined
              ? String(args.account_id)
              : undefined;

          const transactions = await getTransactions({
            start_date,
            end_date,
            limit,
            account_id,
          });

          const lines = transactions.map(
            (t) =>
              `${t.date} | ${t.merchant} | $${t.amount.toFixed(2)} | ${t.category} | ${t.account_name}`
          );

          return {
            content: [
              {
                type: "text",
                text:
                  transactions.length === 0
                    ? "No transactions found for the given date range."
                    : `Found ${transactions.length} transaction(s):\n\n${lines.join("\n")}`,
              },
            ],
          };
        }

        case "get_accounts": {
          const accounts = await getAccounts();

          if (accounts.length === 0) {
            return {
              content: [{ type: "text", text: "No linked accounts found." }],
            };
          }

          const lines = accounts.map(
            (a) =>
              `${a.name} (${a.institution}) — ${a.type} — $${a.balance.toFixed(2)}`
          );

          return {
            content: [
              {
                type: "text",
                text: `${accounts.length} linked account(s):\n\n${lines.join("\n")}`,
              },
            ],
          };
        }

        case "get_balances": {
          const snapshot = await getNetWorth();

          const topLines = snapshot.top_accounts.map(
            (a) => `  • ${a.name} (${a.type}): $${a.balance.toFixed(2)}`
          );

          const text = [
            `Net Worth Snapshot`,
            `──────────────────`,
            `Assets:      $${snapshot.assets.toFixed(2)}`,
            `Liabilities: $${snapshot.liabilities.toFixed(2)}`,
            `Net Worth:   $${snapshot.net_worth.toFixed(2)}`,
            ``,
            `Top accounts by absolute value:`,
            ...topLines,
          ].join("\n");

          return { content: [{ type: "text", text }] };
        }

        case "get_cashflow": {
          const months = args.months !== undefined ? Number(args.months) : 3;
          const cashflow = await getCashflow(months);

          if (cashflow.length === 0) {
            return {
              content: [{ type: "text", text: "No transaction data found for the requested period." }],
            };
          }

          const lines = cashflow.map(
            (m) =>
              `${m.month}  Income: $${m.income.toFixed(2)}  Expenses: $${m.expenses.toFixed(2)}  Net: ${m.net >= 0 ? "+" : ""}$${m.net.toFixed(2)}`
          );

          const totalIncome   = cashflow.reduce((s, m) => s + m.income, 0);
          const totalExpenses = cashflow.reduce((s, m) => s + m.expenses, 0);
          const totalNet      = totalIncome - totalExpenses;

          const text = [
            `Cashflow — last ${months} month(s):`,
            ``,
            ...lines,
            ``,
            `Total  Income: $${totalIncome.toFixed(2)}  Expenses: $${totalExpenses.toFixed(2)}  Net: ${totalNet >= 0 ? "+" : ""}$${totalNet.toFixed(2)}`,
          ].join("\n");

          return { content: [{ type: "text", text }] };
        }

        case "get_budgets": {
          const month = args.month !== undefined ? String(args.month) : undefined;
          const comparison = await getBudgets(month);

          if (comparison.groups.length === 0) {
            return {
              content: [{ type: "text", text: "No budget data found for the requested month." }],
            };
          }

          const lines: string[] = [`Budget vs Actual — ${comparison.month}`, ``];

          for (const grp of comparison.groups) {
            if (grp.type === "transfer") continue;
            lines.push(
              `${grp.name} (${grp.type}): planned $${grp.planned.toFixed(2)} | actual $${grp.actual.toFixed(2)} | remaining $${grp.remaining.toFixed(2)}`
            );
            for (const cat of grp.categories) {
              lines.push(
                `  • ${cat.name}: $${cat.actual.toFixed(2)} / $${cat.planned.toFixed(2)}`
              );
            }
          }

          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
