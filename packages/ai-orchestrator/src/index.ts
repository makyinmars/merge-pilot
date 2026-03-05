import {
  CodexReviewRequestSchema,
  CodexReviewResponseSchema,
  type CodexReviewRequest,
  type CodexReviewResponse
} from "@mergepilot/shared-types";
import { ZodError } from "zod";

export type OrchestratorErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "CANCELLED"
  | "TIMEOUT"
  | "EXECUTION_FAILED";

export class CodexOrchestratorError extends Error {
  public readonly code: OrchestratorErrorCode;
  public readonly retryable: boolean;

  public constructor(
    code: OrchestratorErrorCode,
    message: string,
    retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "CodexOrchestratorError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface RunCodexReviewParams {
  request: unknown;
  execute: (request: CodexReviewRequest, signal: AbortSignal) => Promise<unknown>;
  signal?: AbortSignal;
}

export interface RunCodexReviewResult {
  response: CodexReviewResponse;
  attempts: number;
  elapsedMs: number;
}

interface TimeoutHandle {
  signal: AbortSignal;
  dispose: () => void;
  timedOut: () => boolean;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createTimeoutHandle(timeoutMs: number, parentSignal?: AbortSignal): TimeoutHandle {
  const timeoutController = new AbortController();
  let didTimeout = false;
  let parentListener: (() => void) | null = null;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    timeoutController.abort();
  }, timeoutMs);

  if (parentSignal) {
    if (parentSignal.aborted) {
      timeoutController.abort();
    } else {
      parentListener = () => {
        timeoutController.abort();
      };
      parentSignal.addEventListener("abort", parentListener, { once: true });
    }
  }

  return {
    signal: timeoutController.signal,
    timedOut: () => didTimeout,
    dispose: () => {
      clearTimeout(timeoutId);
      if (parentSignal && parentListener) {
        parentSignal.removeEventListener("abort", parentListener);
      }
    }
  };
}

function normalizeFailure(error: unknown, timedOut: boolean, parentSignal?: AbortSignal): CodexOrchestratorError {
  if (timedOut) {
    return new CodexOrchestratorError("TIMEOUT", "Codex request exceeded timeout window.", true, {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (parentSignal?.aborted) {
    return new CodexOrchestratorError("CANCELLED", "Codex request was cancelled.", false, {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (error instanceof ZodError) {
    return new CodexOrchestratorError("INVALID_RESPONSE", "Codex response did not match contract schema.", false, {
      cause: error
    });
  }

  if (error instanceof CodexOrchestratorError) {
    return error;
  }

  return new CodexOrchestratorError("EXECUTION_FAILED", "Codex execution failed unexpectedly.", true, {
    cause: error instanceof Error ? error : undefined
  });
}

export async function runCodexReview(params: RunCodexReviewParams): Promise<RunCodexReviewResult> {
  const parseRequest = CodexReviewRequestSchema.safeParse(params.request);
  if (!parseRequest.success) {
    throw new CodexOrchestratorError(
      "INVALID_REQUEST",
      `Codex review request failed validation: ${parseRequest.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")}`,
      false,
      { cause: parseRequest.error }
    );
  }

  const request = parseRequest.data;
  const startedAt = Date.now();
  const maxAttempts = request.timeoutPolicy.maxRetries + 1;
  let attempts = 0;
  let lastError: CodexOrchestratorError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    const timeoutHandle = createTimeoutHandle(request.timeoutPolicy.requestTimeoutMs, params.signal);

    try {
      const rawResponse = await params.execute(request, timeoutHandle.signal);
      const parsedResponse = CodexReviewResponseSchema.parse(rawResponse);

      return {
        response: parsedResponse,
        attempts,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      const normalizedError = normalizeFailure(error, timeoutHandle.timedOut(), params.signal);
      timeoutHandle.dispose();

      if (!normalizedError.retryable || attempt >= maxAttempts) {
        throw normalizedError;
      }

      lastError = normalizedError;
      await sleep(request.timeoutPolicy.retryBackoffMs * attempt);
      continue;
    } finally {
      timeoutHandle.dispose();
    }
  }

  throw (
    lastError ??
    new CodexOrchestratorError("EXECUTION_FAILED", "Codex request exited without response or error.", true)
  );
}
