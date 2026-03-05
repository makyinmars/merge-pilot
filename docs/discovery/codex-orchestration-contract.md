# Codex Orchestration Contract (Phase 1)

## Goal
Define a strict execution contract so Codex review requests are deterministic, cancellable, and auditable.

## Implemented Contract
- Source schema: `packages/shared-types/src/codex.ts`
- Runtime orchestrator: `packages/ai-orchestrator/src/index.ts`

## Request Schema
`CodexReviewRequest`
- `model`: non-empty model identifier.
- `scope`: `session | files`.
- `context`: repository path, refs, review goal, and one or more patch items.
- `timeoutPolicy`:
  - `requestTimeoutMs` default `12000`
  - `maxRetries` default `1`
  - `retryBackoffMs` default `750`
- `metadata` (optional): request provenance and deterministic execution flag.

## Response Schema
`CodexReviewResponse`
- `summary`: short PR-style summary.
- `findings[]`: typed severity finding records (file + rationale + optional recommendation).
- `suggestions[]`: optional actionable suggestions.
- `tokenUsage` (optional): input and output counters.
- `provenance`: model, prompt hash, generation timestamp.

## Error Contract
`CodexOrchestratorError`
- `INVALID_REQUEST`: request payload failed schema validation.
- `INVALID_RESPONSE`: model output failed response schema validation.
- `CANCELLED`: parent signal cancelled execution.
- `TIMEOUT`: request exceeded timeout policy.
- `EXECUTION_FAILED`: provider/runtime error.

Each error exposes:
- `code`
- `message`
- `retryable`

## Cancellation Behavior
- A per-attempt `AbortController` is created and linked to parent cancellation.
- Timeout cancellation and user cancellation are differentiated.
- Retries happen only for retryable failures (`TIMEOUT`, `EXECUTION_FAILED`) and are capped by `maxRetries`.

## Phase 2 Follow-up
- Add chunking strategy for very large diffs.
- Add prompt-hash helper package for persisted reproducibility checks.
- Add schema-level unit tests for malformed model outputs.
