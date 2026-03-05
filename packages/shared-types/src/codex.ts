import { z } from "zod";

export const ReviewScopeSchema = z.enum(["session", "files"]);
export type ReviewScope = z.infer<typeof ReviewScopeSchema>;

export const ReviewSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export const PromptContextItemSchema = z.object({
  filePath: z.string().min(1),
  language: z.string().min(1).optional(),
  patch: z.string().min(1),
  hunkAnchor: z.string().min(1).optional()
});
export type PromptContextItem = z.infer<typeof PromptContextItemSchema>;

export const PromptContextSchema = z.object({
  repositoryPath: z.string().min(1),
  sessionId: z.string().min(1),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
  reviewGoal: z.string().min(1),
  items: z.array(PromptContextItemSchema).min(1)
});
export type PromptContext = z.infer<typeof PromptContextSchema>;

export const TimeoutPolicySchema = z.object({
  requestTimeoutMs: z.number().int().min(5000).max(120000).default(12000),
  maxRetries: z.number().int().min(0).max(3).default(1),
  retryBackoffMs: z.number().int().min(0).max(30000).default(750)
});
export type TimeoutPolicy = z.infer<typeof TimeoutPolicySchema>;

export const CodexReviewRequestSchema = z.object({
  model: z.string().min(1),
  scope: ReviewScopeSchema.default("session"),
  context: PromptContextSchema,
  timeoutPolicy: TimeoutPolicySchema.default({
    requestTimeoutMs: 12000,
    maxRetries: 1,
    retryBackoffMs: 750
  }),
  metadata: z
    .object({
      requestedBy: z.string().min(1),
      requestedAt: z.string().datetime({ offset: true }),
      deterministic: z.boolean().default(true)
    })
    .optional()
});
export type CodexReviewRequest = z.infer<typeof CodexReviewRequestSchema>;

export const CodexFindingSchema = z.object({
  id: z.string().min(1),
  severity: ReviewSeveritySchema,
  title: z.string().min(1),
  rationale: z.string().min(1),
  filePath: z.string().min(1),
  hunkAnchor: z.string().min(1).optional(),
  recommendation: z.string().min(1).optional()
});
export type CodexFinding = z.infer<typeof CodexFindingSchema>;

export const CodexSuggestionSchema = z.object({
  filePath: z.string().min(1),
  suggestion: z.string().min(1),
  patchHint: z.string().min(1).optional()
});
export type CodexSuggestion = z.infer<typeof CodexSuggestionSchema>;

export const CodexReviewResponseSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(CodexFindingSchema),
  suggestions: z.array(CodexSuggestionSchema),
  tokenUsage: z
    .object({
      input: z.number().int().min(0),
      output: z.number().int().min(0)
    })
    .optional(),
  provenance: z.object({
    model: z.string().min(1),
    promptHash: z.string().min(1),
    generatedAt: z.string().datetime({ offset: true })
  })
});
export type CodexReviewResponse = z.infer<typeof CodexReviewResponseSchema>;

export const TypedErrorSchema = z.object({
  code: z.enum([
    "INVALID_REQUEST",
    "INVALID_RESPONSE",
    "CANCELLED",
    "TIMEOUT",
    "EXECUTION_FAILED"
  ]),
  message: z.string().min(1),
  retryable: z.boolean()
});
export type TypedError = z.infer<typeof TypedErrorSchema>;
