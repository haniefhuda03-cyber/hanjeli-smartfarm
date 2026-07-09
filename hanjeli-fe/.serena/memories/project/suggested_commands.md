# Suggested Commands

Package manager is **npm** (a `package-lock.json` lives at the repo root; do not switch to pnpm/yarn).

## Development

| Command            | What it does                                      |
|--------------------|---------------------------------------------------|
| `npm run dev`      | Start dev server on http://localhost:3000         |
| `npm run build`    | Production build                                  |
| `npm start`        | Run the production build                          |
| `npm run lint`     | ESLint (config in `eslint.config.mjs`)            |
| `npx tsc --noEmit` | Type-check the whole project (no script alias)    |

Before reporting a UI change complete:
1. `npx tsc --noEmit` must pass.
2. Open the affected route in the browser and verify both `id` and `en` translations render.
3. If a data shape changed, update `db.md` in the same commit.

## System (Windows / PowerShell)
The dev environment is Windows 11 + PowerShell. Bash via `bash` / Claude Code's Bash tool also works.

| Action                  | PowerShell              | Bash       |
|-------------------------|-------------------------|------------|
| List directory          | `Get-ChildItem` / `ls`  | `ls`       |
| Show file               | `Get-Content` / `cat`   | `cat`      |
| Search file contents    | `Select-String`         | `grep`/`rg`|
| Recursive file search   | `Get-ChildItem -Recurse`| `find`     |
| Env var                 | `$env:NAME`             | `$NAME`    |

Prefer the Claude Code dedicated tools: **Glob** for file search, **Grep** for content search, **Read** for files, **Edit/Write** for edits.

## Git
Repository root is `hanjeli-fe/` (this folder is a git repo). Use `git status`, `git diff`, `git log` normally. Worktrees may exist under `.claude/worktrees/` — leave them alone unless explicitly told to touch them.
