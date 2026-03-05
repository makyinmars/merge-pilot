# MergePilot

Phase 1 (`Discovery`) bootstrap for MergePilot.

## Toolchain Baseline
- Bun: `1.3.9` (`packageManager`)
- Node types: `@types/node@^24.10.0`
- TypeScript: `^5.9.3`
- TS policy: `strict` + strictness extensions in `tsconfig.base.json`

## Source Of Truth Workflow (Obsidian-First)
- Canonical planning/status docs live in Obsidian:
  - `/Users/franklin/Development/Obsidian/Maky Software Inc/Projects/MergePilot.md`
  - `/Users/franklin/Development/Obsidian/Maky Software Inc/Projects/MergePilot/Items/`
- Use Obsidian CLI to open/update project notes during execution:
  - `obsidian "/Users/franklin/Development/Obsidian/Maky Software Inc/Projects/MergePilot.md"`
  - `obsidian "/Users/franklin/Development/Obsidian/Maky Software Inc/Projects/MergePilot/Items"`
- Use Obsidian skills when updating source-of-truth artifacts:
  - `obsidian-bases` skill for `.base` views/formulas/filters.
  - Project note/task-note updates for phase status, completion notes, and artifact links.
- Keep repo docs (`README.md`, `AGENTS.md`) aligned after any Obsidian source-of-truth changes.

## Workspace Packages
- `@mergepilot/shared-types`: cross-package schemas and domain contracts.
- `@mergepilot/ai-orchestrator`: Codex execution contract, timeout policy, and cancellation handling.
- `@mergepilot/diff-providers`: provider abstraction and `diffs.com` Phase 1 export/deep-link baseline.

## Scripts
- `bun run typecheck`
