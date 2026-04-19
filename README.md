# claude-monarch

MCP server running on Synology NAS that exposes Monarch Money financial data as queryable tools — transactions, accounts, and balances by institution, entity, or date range.

## Features
- Query transactions by account, institution, and date range (e.g. "Fidelity / Xity LLC / last year")
- Filter by category, merchant, or amount
- Expose account balances and net worth snapshots
- Runs as a container on Synology NAS, accessible to Claude Code

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (TypeScript) |
| Protocol | MCP (Model Context Protocol) |
| Data source | Monarch Money API / session token |
| Deployment | Synology NAS Docker container |

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally (requires MONARCH_TOKEN in .env)
npm start

# Run tests
npm test
```

## Environment Variables
| Variable | Description |
|---|---|
| `MONARCH_TOKEN` | Monarch Money session/API token |

## Project Status
Early development. See [ROADMAP.md](ROADMAP.md) for what's planned.

---
**Publisher:** Xity Software, LLC
