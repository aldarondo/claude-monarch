# claude-monarch Roadmap
> Tag key: `[Code]` = Claude Code · `[Cowork]` = Claude Cowork · `[Human]` = Charles must act

## 🔄 In Progress
<!-- nothing in progress -->

## 🔲 Backlog
- [x] `[Code]` 2026-04-19 — Add `get_cashflow` tool — monthly income vs expenses derived from transactions; N months lookback; 2 unit tests added
- [ ] `[Code]` Integrate `get_budgets` tool for budget vs actual comparison
- [x] `[Code]` 2026-04-19 — Write server dispatch integration tests — 6 tests covering all 4 tools + error path via InMemoryTransport; fixed moduleNameMapper for `.js` → `.ts` resolution in jest config
- [ ] `[Code]` Publish Docker image to Synology container registry

## ✅ Completed
- [x] `[Code]` Define project game plan — 2026-04-19
- [x] `[Code]` Research Monarch Money API (monarch-money-ts npm package) — 2026-04-19
- [x] `[Code]` Scaffold MCP server skeleton with `get_transactions`, `get_accounts`, `get_balances` tools — 2026-04-19
- [x] `[Code]` Containerize with Dockerfile + docker-compose.yml for Synology NAS deployment — 2026-04-19
- [x] `[Code]` Write unit tests for core logic (7 unit tests) — 2026-04-19
- [x] `[Code]` Write integration tests for end-to-end flows (3 integration tests) — 2026-04-19

## 🚫 Blocked
- ❌ [docker-monitor:deploy-failed] GitHub Actions deploy failed (run #24690306222) — https://github.com/aldarondo/claude-monarch/actions/runs/24690306222 — 2026-04-21 08:00 UTC
- `[Human]` Obtain `MONARCH_TOKEN` — needed before any live API calls work. Once in hand, set it in `.env` (see `.env.example`).
- `[Human]` Add `NAS_SSH_PASSWORD` to GitHub repo secrets (Settings → Secrets → Actions) — required for deploy workflow to SSH into the NAS.
- ~~`[Human]` First-time NAS setup~~ Done 2026-04-19 — `/volume1/docker/claude-monarch/` deployed, container running
- `[Human]` Set `MONARCH_TOKEN` in `/volume1/docker/claude-monarch/.env` then `docker compose restart claude-monarch`
