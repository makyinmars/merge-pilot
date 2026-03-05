import {
  GitDiffFileSchema,
  GitDiffResultSchema,
  GitRepositorySchema,
  HunkNavigationSchema,
  SplitDiffViewModelSchema,
  UnifiedDiffViewModelSchema,
  WORKING_TREE_REF
} from "@mergepilot/shared-types";
import { z } from "zod";

export const IPC_CHANNELS = {
  getDefaultRepositoryPath: "mergepilot:get-default-repository-path",
  loadReviewSession: "mergepilot:load-review-session"
} as const;

export const DefaultRepositoryPathResponseSchema = z.object({
  repositoryPath: z.string().min(1)
});
export type DefaultRepositoryPathResponse = z.infer<typeof DefaultRepositoryPathResponseSchema>;

export const LoadReviewSessionRequestSchema = z.object({
  repositoryPath: z.string().min(1),
  baseRef: z.string().min(1).default("HEAD"),
  headRef: z.union([z.string().min(1), z.literal(WORKING_TREE_REF)]).default(WORKING_TREE_REF),
  contextLines: z.number().int().min(0).max(20).default(3),
  includePaths: z.array(z.string().min(1)).optional(),
  excludePaths: z.array(z.string().min(1)).optional(),
  languageHint: z.string().min(1).optional()
});
export type LoadReviewSessionRequest = z.infer<typeof LoadReviewSessionRequestSchema>;

export const ReviewFileViewsSchema = z.object({
  unified: UnifiedDiffViewModelSchema,
  split: SplitDiffViewModelSchema,
  navigation: z.object({
    unified: HunkNavigationSchema,
    split: HunkNavigationSchema
  })
});
export type ReviewFileViews = z.infer<typeof ReviewFileViewsSchema>;

export const ReviewFileViewSchema = z.object({
  file: GitDiffFileSchema,
  views: ReviewFileViewsSchema.optional(),
  renderError: z.string().min(1).optional()
});
export type ReviewFileView = z.infer<typeof ReviewFileViewSchema>;

export const LoadReviewSessionResponseSchema = z.object({
  repository: GitRepositorySchema,
  diff: GitDiffResultSchema,
  files: z.array(ReviewFileViewSchema)
});
export type LoadReviewSessionResponse = z.infer<typeof LoadReviewSessionResponseSchema>;

export interface MergePilotBridge {
  getDefaultRepositoryPath(): Promise<DefaultRepositoryPathResponse>;
  loadReviewSession(request: LoadReviewSessionRequest): Promise<LoadReviewSessionResponse>;
}
