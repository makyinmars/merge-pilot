import { z } from "zod";

export const DiffFileStatusSchema = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type-changed",
  "unmerged"
]);
export type DiffFileStatus = z.infer<typeof DiffFileStatusSchema>;

export const DiffFileExportSchema = z.object({
  path: z.string().min(1),
  status: DiffFileStatusSchema,
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  oldPath: z.string().min(1).optional(),
  patch: z.string().optional()
});
export type DiffFileExport = z.infer<typeof DiffFileExportSchema>;

export const ReviewSessionExportSchema = z.object({
  sessionId: z.string().min(1),
  repositoryPath: z.string().min(1),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  files: z.array(DiffFileExportSchema).min(1),
  includePaths: z.array(z.string().min(1)).optional(),
  excludePaths: z.array(z.string().min(1)).optional()
});
export type ReviewSessionExport = z.infer<typeof ReviewSessionExportSchema>;

export const DiffProviderExportPayloadSchema = z.object({
  provider: z.string().min(1),
  exportedAt: z.iso.datetime({ offset: true }),
  session: ReviewSessionExportSchema,
  metadata: z
    .object({
      source: z.literal("mergepilot"),
      version: z.string().min(1)
    })
    .default({ source: "mergepilot", version: "0.1.0" })
});
export type DiffProviderExportPayload = z.infer<typeof DiffProviderExportPayloadSchema>;

export const ExternalReviewStatusSchema = z.object({
  provider: z.string().min(1),
  state: z.enum(["not-supported", "pending", "ready", "failed"]),
  url: z.url().optional(),
  externalId: z.string().optional(),
  checkedAt: z.iso.datetime({ offset: true }),
  reason: z.string().optional()
});
export type ExternalReviewStatus = z.infer<typeof ExternalReviewStatusSchema>;
