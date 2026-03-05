import { z } from "zod";
import { DiffFileStatusSchema } from "./diff-provider.js";

export const WORKING_TREE_REF = "WORKING_TREE" as const;
export const WorkingTreeRefSchema = z.literal(WORKING_TREE_REF);

export const GitRefInputSchema = z.union([z.string().min(1), WorkingTreeRefSchema]);
export type GitRefInput = z.infer<typeof GitRefInputSchema>;

export const GitRefKindSchema = z.enum([
  "branch",
  "tag",
  "commit",
  "stash",
  "working-tree",
  "unknown"
]);
export type GitRefKind = z.infer<typeof GitRefKindSchema>;

export const GitOpenRepositoryRequestSchema = z.object({
  repositoryPath: z.string().min(1)
});
export type GitOpenRepositoryRequest = z.infer<typeof GitOpenRepositoryRequestSchema>;

export const GitRepositorySchema = z.object({
  repositoryPath: z.string().min(1),
  rootPath: z.string().min(1),
  gitDir: z.string().min(1),
  isBare: z.boolean(),
  defaultBranch: z.string().min(1).optional(),
  headRef: z.string().min(1).optional()
});
export type GitRepository = z.infer<typeof GitRepositorySchema>;

export const GitResolveRefRequestSchema = z.object({
  repositoryPath: z.string().min(1),
  ref: GitRefInputSchema
});
export type GitResolveRefRequest = z.infer<typeof GitResolveRefRequestSchema>;

export const GitResolvedRefSchema = z.object({
  input: GitRefInputSchema,
  normalized: z.string().min(1),
  kind: GitRefKindSchema,
  objectId: z.string().regex(/^[0-9a-f]{40}$/i).optional(),
  symbolicName: z.string().min(1).optional()
});
export type GitResolvedRef = z.infer<typeof GitResolvedRefSchema>;

export const GitDiffRequestSchema = z.object({
  repositoryPath: z.string().min(1),
  baseRef: GitRefInputSchema,
  headRef: GitRefInputSchema.default(WORKING_TREE_REF),
  includePaths: z.array(z.string().min(1)).optional(),
  excludePaths: z.array(z.string().min(1)).optional(),
  contextLines: z.number().int().min(0).max(20).default(3),
  includePatch: z.boolean().default(true)
});
export type GitDiffRequest = z.infer<typeof GitDiffRequestSchema>;

export const GitDiffFileSchema = z.object({
  path: z.string().min(1),
  status: DiffFileStatusSchema,
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  oldPath: z.string().min(1).optional(),
  isBinary: z.boolean().default(false),
  patch: z.string().optional()
});
export type GitDiffFile = z.infer<typeof GitDiffFileSchema>;

export const GitDiffResultSchema = z.object({
  repositoryPath: z.string().min(1),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
  comparedAt: z.iso.datetime({ offset: true }),
  files: z.array(GitDiffFileSchema)
});
export type GitDiffResult = z.infer<typeof GitDiffResultSchema>;

export const GitAdapterErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "INVALID_RESPONSE",
  "INVALID_REPOSITORY",
  "INVALID_REF",
  "COMMAND_FAILED"
]);
export type GitAdapterErrorCode = z.infer<typeof GitAdapterErrorCodeSchema>;
