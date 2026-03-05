# diffs.com Integration Path Validation (Phase 1)

## Goal
Validate delivery options for `diffs.com` integration without blocking local review workflow.

## Implemented Baseline
- Contract and baseline adapter: `packages/diff-providers/src/index.ts`
- Provider implementation: `packages/diff-providers/src/diffs-com.ts`
- Shared payload schema: `packages/shared-types/src/diff-provider.ts`

## Options Reviewed
1. Deep-link only
- Pros: fastest path, no API dependency.
- Cons: payload size constraints in URL.

2. Export payload handoff
- Pros: preserves full session payload locally, works without upload API.
- Cons: requires manual import/open flow.

3. API sync (future)
- Pros: automatic upload, linkback, and status sync.
- Cons: blocked on external API capabilities and auth model.

## Phase 1 Decision
Adopt hybrid fallback:
- Use deep-link when serialized payload is below configured byte budget (`8 KB` by default).
- Fallback to manual handoff when payload exceeds deep-link budget.
- Keep local session state canonical in MergePilot.
- Mark `syncExternalStatus` as `not-supported` until API capabilities are confirmed.

## Adapter Behavior
- `prepareExport(session)`
  - Validates session payload.
  - Produces provider payload + hash.
  - Chooses `deep-link` or `manual` mode.
- `openExternalReview(preparedExport)`
  - Returns deep-link URL when possible.
  - Falls back to diffs.com root URL + manual note.
- `syncExternalStatus()`
  - Returns a typed `not-supported` status in Phase 1.

## Phase 2 Follow-up
- Replace manual fallback with authenticated upload when API contract is confirmed.
- Persist `externalId` and sync timestamps in local storage.
- Add reconciliation job for stale external links.
