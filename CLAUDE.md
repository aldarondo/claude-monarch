# claude-monarch

## Project Purpose
MCP server on Synology NAS that exposes Monarch Money financial data as queryable tools for Claude Code.

## Key Commands
```bash
npm install       # install dependencies
npm run build     # compile TypeScript
npm start         # run server (requires MONARCH_TOKEN)
npm test          # run all tests (jest)
```

## Testing Requirements (mandatory)
- Every feature or bug fix must include unit tests covering the core logic
- Every user-facing flow must have at least one integration test
- Tests live in `tests/unit/` and `tests/integration/`
- Run all tests before marking any task complete: `npm test`

## After Every Completed Task (mandatory)
- Move the task to ✅ Completed in ROADMAP.md with today's date
- Update README.md if any feature, command, setup step, or interface changed

## Git Rules
- Never create pull requests. Push directly to main.
- solo/auto-push OK

## Skills
Before implementing any custom solution, check available skills first — prefer `/skill-name` over writing new code. The full list is visible in the Claude Code session context.

@~/Documents/GitHub/CLAUDE.md
