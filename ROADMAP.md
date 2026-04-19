# claude-monarch Roadmap
> Tag key: `[Code]` = Claude Code · `[Cowork]` = Claude Cowork · `[Human]` = Charles must act

## 🔄 In Progress
<!-- nothing in progress -->

## 🔲 Backlog
- [ ] `[Code]` Add `get_cashflow` tool (monthly income vs expenses summary)
- [ ] `[Code]` Integrate `get_budgets` tool for budget vs actual comparison
- [ ] `[Code]` Write additional integration tests for server.ts tool dispatch layer
- [ ] `[Code]` Publish Docker image to Synology container registry

## ✅ Completed
- [x] `[Code]` Define project game plan — 2026-04-19
- [x] `[Code]` Research Monarch Money API (monarch-money-ts npm package) — 2026-04-19
- [x] `[Code]` Scaffold MCP server skeleton with `get_transactions`, `get_accounts`, `get_balances` tools — 2026-04-19
- [x] `[Code]` Containerize with Dockerfile + docker-compose.yml for Synology NAS deployment — 2026-04-19
- [x] `[Code]` Write unit tests for core logic (7 unit tests) — 2026-04-19
- [x] `[Code]` Write integration tests for end-to-end flows (3 integration tests) — 2026-04-19

## 🚫 Blocked
- `[Human]` Obtain `MONARCH_TOKEN` — needed before any live API calls work. Once in hand, set it in `.env` (see `.env.example`).
