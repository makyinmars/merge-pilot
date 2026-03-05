# Review UX Diff Viewer Baseline (Phase 3)

## Goal
Ship the first Review UX baseline contracts and rendering models for:
- unified diff view
- side-by-side diff view
- hunk navigation anchors
- large-file virtualization range math
- syntax tokenization for line rendering

## Implemented Artifacts
- `packages/review-ux/src/index.ts`
- `packages/review-ux/package.json`
- `packages/shared-types/src/review-ux.ts`
- `packages/shared-types/src/index.ts`
- `tsconfig.base.json`

## Review UX Surface
`@mergepilot/review-ux` exposes:
- `buildUnifiedDiffViewModel(request)`
- `buildSplitDiffViewModel(request)`
- `buildHunkNavigation(request)`
- `calculateVirtualizedWindow(request)`
- `buildDiffViews(request)`

All API entrypoints validate request and response payloads with Zod contracts from `@mergepilot/shared-types`.

## Behavior Notes
- Parses git unified patch text into hunk and line-level models.
- Accepts Git add/delete hunk headers with zero-side start lines (for example `@@ -0,0 +N,M @@`).
- Produces row-based models ready for renderer virtualization.
- Supports split-view alignment of deletion/addition blocks.
- Emits hunk anchors for keyboard and panel navigation.
- Detects language from file extension with optional explicit override.
- Tokenizes code lines into coarse syntax classes (`keyword`, `string`, `comment`, etc.) to support renderer highlighting.
- Computes padded virtualized windows (`startIndex`, `endIndex`, `paddingTop`, `paddingBottom`) for large files.

## Error Contract
`ReviewUxError` codes:
- `INVALID_REQUEST`
- `INVALID_RESPONSE`
- `PATCH_PARSE_FAILED`

## Validation
- `bun run typecheck` at repo root.
