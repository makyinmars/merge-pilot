# MergePilot

Phase 2 (`Foundation`) baseline completed. Phase 3 (`Review UX`) now includes a runnable Electron desktop slice.

## Toolchain Baseline
- Bun: `1.3.9` (`packageManager`)
- Node types: `@types/node@^24.10.0`
- TypeScript: `^5.9.3`
- Zod: `^4.3.6` (centralized via Bun `catalog` in root `package.json`)
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
- `@mergepilot/git-adapter`: local read-only Git adapter for repo open, ref resolution, and diff generation.
- `@mergepilot/ai-orchestrator`: Codex execution contract, timeout policy, and cancellation handling.
- `@mergepilot/diff-providers`: provider abstraction and `diffs.com` Phase 1 export/deep-link baseline.
- `@mergepilot/review-ux`: diff viewer model generation for unified/split layouts, hunk navigation anchors, syntax tokenization, and virtualization math.
- `@mergepilot/desktop-app`: runnable Electron desktop slice for local review workflows.

## Foundation Artifacts
- `docs/foundation/git-adapter-read-only-baseline.md`

## Review UX Artifacts
- `docs/review-ux/diff-viewer-baseline.md`
- `docs/review-ux/desktop-runnable-slice.md`

## Scripts
- `bun run typecheck`
- `bun run desktop:build`
- `bun run desktop:start`
