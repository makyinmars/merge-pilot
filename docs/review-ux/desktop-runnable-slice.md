# Review UX Desktop Runnable Slice (Phase 3)

## Goal
Ship a runnable Electron desktop slice that proves the full Review UX loop:
- open local repository
- generate Git diff (`baseRef` -> `headRef`)
- render file-level diff list
- render both unified and side-by-side views
- navigate hunks and virtualize rows for large files

## Implemented Artifacts
- `packages/desktop-app/src/main.ts`
- `packages/desktop-app/src/preload.ts`
- `packages/desktop-app/src/ipc-contracts.ts`
- `packages/desktop-app/src/renderer.ts`
- `packages/desktop-app/src/renderer.css`
- `packages/desktop-app/src/index.html`
- `packages/desktop-app/src/renderer-globals.d.ts`
- `packages/desktop-app/package.json`
- `package.json` (desktop scripts + Electron dependency)

## Slice Architecture
- `main`: owns Git/review orchestration and IPC handlers.
- `preload`: exposes a minimal typed bridge (`window.mergepilot`) and validates requests/responses with Zod.
- `renderer`: UI-only diff workflow. No direct FS/network privileges.

## IPC Surface
- `mergepilot:get-default-repository-path`
- `mergepilot:load-review-session`

Both channels validate:
- request payload in preload + main
- response payload in main + preload

## Run
- `bun install`
- `bun run desktop:start`

## Validation
- `bun run typecheck`
