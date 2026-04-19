# claude-monarch

MCP server running on Synology NAS that exposes Monarch Money financial data as queryable tools — transactions, accounts, and balances.

## Features
- `get_transactions` — query by date range, optionally filter by account ID
- `get_accounts` — list all linked accounts with name, institution, type, and balance
- `get_balances` — net worth snapshot (assets, liabilities, net total, top 5 accounts)
- Two transports: **stdio** (Claude Code MCP config) and **SSE/HTTP** (Docker/NAS on port 8775)

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (TypeScript) |
| Protocol | MCP (`@modelcontextprotocol/sdk`) |
| Data source | `monarch-money-ts` npm package (unofficial GraphQL API) |
| Deployment | Synology NAS Docker container (port 8775) |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your Monarch Money token
cp .env.example .env
# Edit .env and set MONARCH_TOKEN=...

# 3. Build
npm run build

# 4. Run (stdio mode — for Claude Code)
npm start

# 5. Run (SSE/HTTP mode — for Docker/NAS)
npm run serve

# 6. Run tests
npm test
```

## Claude Code MCP Config (stdio)

```json
{
  "mcpServers": {
    "monarch": {
      "command": "node",
      "args": ["/path/to/claude-monarch/dist/index.js"],
      "env": { "MONARCH_TOKEN": "your_token_here" }
    }
  }
}
```

## Docker / NAS (SSE)

```bash
docker compose up -d
# MCP SSE endpoint: http://nas:8775/sse
# Health check:     http://nas:8775/health
```

## Environment Variables
| Variable | Description |
|---|---|
| `MONARCH_TOKEN` | Monarch Money session token (required) |
| `PORT` | Override SSE server port (default: 8775) |

## Getting a Token

```bash
node -e "
const { EmailPasswordAuthProvider } = require('monarch-money-ts');
const auth = new EmailPasswordAuthProvider({ email: 'you@email.com', password: 'yourpassword' });
auth.getToken().then(t => console.log(t));
"
```

## Project Status
Scaffold complete. Blocked on `MONARCH_TOKEN` for live testing. See [ROADMAP.md](ROADMAP.md).

---
**Publisher:** Xity Software, LLC
