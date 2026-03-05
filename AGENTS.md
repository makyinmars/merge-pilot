# AGENTS.md

## Mission

Build MergePilot as a desktop-first Electron code review app with fast local diff workflows, optional Codex assistance, and provider-based external export (`diffs.com` first).

## Source Of Truth

- Product/project notes: `/Users/franklin/Development/Obsidian/Maky Software Inc/Projects/MergePilot.md`
- Task tracker: `/Users/franklin/Development/Obsidian/Maky Software Inc/Projects/MergePilot/Items/`

## Current Delivery State

- Discovery phase: complete.
- Next phase: Foundation (`Build local git adapter read-only baseline`).

## Architecture Guardrails

- Renderer: UI-only, no privileged FS/network access.
- Preload: minimal typed bridge (`window.mergepilot.*`), never expose raw `ipcRenderer`.
- Main: orchestration, IPC handling, storage, integrations.
- Validate IPC payloads with Zod at both request and response boundaries.

## TypeScript And Toolchain Policy

- Bun baseline: `1.3.9`.
- Node baseline: `24.x` (types aligned via `@types/node@^24.10.0`).
- TypeScript baseline: `5.9.x`.
- Keep TypeScript in strict-plus mode using:
  - `strict`
  - `noUncheckedIndexedAccess`
  - `exactOptionalPropertyTypes`
  - `noImplicitOverride`
  - `noImplicitReturns`
  - `noFallthroughCasesInSwitch`
  - `noPropertyAccessFromIndexSignature`
  - `useUnknownInCatchVariables`

## Workflow Expectations

- Keep provider integrations behind adapters; local state remains canonical.
- Update relevant Obsidian item notes when a task completes (`status`, completion notes, links to artifacts).
- Run `bun run typecheck` before finalizing work.
