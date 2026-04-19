import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getTransactions, getAccounts, getNetWorth } from "./api.js";

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
