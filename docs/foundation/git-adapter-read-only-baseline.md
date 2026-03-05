# Local Git Adapter Read-Only Baseline (Phase 2 Foundation)

## Goal
Ship a read-only local Git adapter that supports:
- repository open
- ref resolution
- diff generation
- file status metadata

## Implemented Artifacts
- `packages/git-adapter/src/index.ts`
- `packages/git-adapter/package.json`
- `packages/shared-types/src/git.ts`
- `packages/shared-types/src/index.ts`
- `tsconfig.base.json`

## Adapter Surface
`LocalGitAdapter` exposes:
- `openRepository(request)`
- `resolveRef(request)`
- `generateDiff(request)`

All entrypoints validate request and response shapes via shared Zod schemas in `@mergepilot/shared-types`.

## Behavior Notes
- Uses `git` CLI in read-only mode (`rev-parse`, `symbolic-ref`, `diff`).
- Supports working-tree comparisons via `WORKING_TREE` head ref sentinel.
- Supports include/exclude pathspec filtering.
- Collects file status (`added`, `modified`, `deleted`, `renamed`, `copied`, `type-changed`, `unmerged`).
- Returns per-file metadata:
  - `path`
  - `status`
  - `additions`
  - `deletions`
  - optional `oldPath` for rename/copy
  - optional `patch` when `includePatch` is true

## Error Contract
`GitAdapterError` codes:
- `INVALID_REQUEST`
- `INVALID_RESPONSE`
- `INVALID_REPOSITORY`
- `INVALID_REF`
- `COMMAND_FAILED`

## Validation
- `bun run typecheck` passes at repo root.
