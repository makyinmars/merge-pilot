import { z } from "zod";
import { GitDiffFileSchema } from "./git.js";

export const DiffViewerModeSchema = z.enum(["unified", "split"]);
export type DiffViewerMode = z.infer<typeof DiffViewerModeSchema>;

export const ReviewCodeLanguageSchema = z.enum([
  "plain-text",
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "markdown",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "cpp",
  "c",
  "csharp",
  "css",
  "html",
  "shell",
  "yaml"
]);
export type ReviewCodeLanguage = z.infer<typeof ReviewCodeLanguageSchema>;

export const DiffLineTypeSchema = z.enum(["context", "addition", "deletion", "meta"]);
export type DiffLineType = z.infer<typeof DiffLineTypeSchema>;

export const DiffSyntaxTokenKindSchema = z.enum([
  "plain",
  "keyword",
  "string",
  "number",
  "comment",
  "operator",
  "punctuation",
  "identifier"
]);
export type DiffSyntaxTokenKind = z.infer<typeof DiffSyntaxTokenKindSchema>;

export const DiffSyntaxTokenSchema = z.object({
  kind: DiffSyntaxTokenKindSchema,
  text: z.string().min(1)
});
export type DiffSyntaxToken = z.infer<typeof DiffSyntaxTokenSchema>;

export const DiffHunkLineSchema = z.object({
  lineType: DiffLineTypeSchema,
  symbol: z.enum([" ", "+", "-", "\\"]),
  content: z.string(),
  oldLineNumber: z.number().int().positive().optional(),
  newLineNumber: z.number().int().positive().optional(),
  tokens: z.array(DiffSyntaxTokenSchema).default([])
});
export type DiffHunkLine = z.infer<typeof DiffHunkLineSchema>;

export const DiffHunkSchema = z.object({
  index: z.number().int().min(0),
  header: z.string().min(1),
  // Git uses start=0 for empty sides in add/delete hunks (for example @@ -0,0 +12,4 @@).
  oldStart: z.number().int().min(0),
  oldLines: z.number().int().min(0),
  newStart: z.number().int().min(0),
  newLines: z.number().int().min(0),
  lines: z.array(DiffHunkLineSchema)
});
export type DiffHunk = z.infer<typeof DiffHunkSchema>;

export const UnifiedDiffRowSchema = z.object({
  id: z.string().min(1),
  rowType: z.enum(["file-meta", "hunk-header", "diff-line"]),
  hunkIndex: z.number().int().min(0).optional(),
  lineIndex: z.number().int().min(0).optional(),
  text: z.string().optional(),
  line: DiffHunkLineSchema.optional()
});
export type UnifiedDiffRow = z.infer<typeof UnifiedDiffRowSchema>;

export const UnifiedDiffViewModelSchema = z.object({
  file: GitDiffFileSchema,
  language: ReviewCodeLanguageSchema,
  fileMetaLines: z.array(z.string()),
  hunks: z.array(DiffHunkSchema),
  rows: z.array(UnifiedDiffRowSchema),
  hunkRowOffsets: z.array(z.number().int().min(0)),
  totalRows: z.number().int().min(0)
});
export type UnifiedDiffViewModel = z.infer<typeof UnifiedDiffViewModelSchema>;

export const SplitDiffCellSchema = z.object({
  lineType: DiffLineTypeSchema,
  lineNumber: z.number().int().positive().optional(),
  text: z.string(),
  tokens: z.array(DiffSyntaxTokenSchema).default([])
});
export type SplitDiffCell = z.infer<typeof SplitDiffCellSchema>;

export const SplitDiffRowSchema = z.object({
  id: z.string().min(1),
  rowType: z.enum(["file-meta", "hunk-header", "diff-line"]),
  hunkIndex: z.number().int().min(0).optional(),
  text: z.string().optional(),
  left: SplitDiffCellSchema.optional(),
  right: SplitDiffCellSchema.optional()
});
export type SplitDiffRow = z.infer<typeof SplitDiffRowSchema>;

export const SplitDiffViewModelSchema = z.object({
  file: GitDiffFileSchema,
  language: ReviewCodeLanguageSchema,
  fileMetaLines: z.array(z.string()),
  hunks: z.array(DiffHunkSchema),
  rows: z.array(SplitDiffRowSchema),
  hunkRowOffsets: z.array(z.number().int().min(0)),
  totalRows: z.number().int().min(0)
});
export type SplitDiffViewModel = z.infer<typeof SplitDiffViewModelSchema>;

export const BuildDiffViewRequestSchema = z.object({
  file: GitDiffFileSchema,
  languageHint: z.string().min(1).optional()
});
export type BuildDiffViewRequest = z.infer<typeof BuildDiffViewRequestSchema>;

export const HunkAnchorSchema = z.object({
  id: z.string().min(1),
  hunkIndex: z.number().int().min(0),
  rowIndex: z.number().int().min(0),
  label: z.string().min(1)
});
export type HunkAnchor = z.infer<typeof HunkAnchorSchema>;

export const BuildHunkNavigationRequestSchema = z.object({
  mode: DiffViewerModeSchema,
  hunkRowOffsets: z.array(z.number().int().min(0)),
  currentRowIndex: z.number().int().min(0).optional()
});
export type BuildHunkNavigationRequest = z.infer<typeof BuildHunkNavigationRequestSchema>;

export const HunkNavigationSchema = z.object({
  mode: DiffViewerModeSchema,
  anchors: z.array(HunkAnchorSchema),
  activeHunkIndex: z.number().int().min(0).optional(),
  nextRowIndex: z.number().int().min(0).optional(),
  previousRowIndex: z.number().int().min(0).optional()
});
export type HunkNavigation = z.infer<typeof HunkNavigationSchema>;

export const VirtualizedWindowRequestSchema = z.object({
  scrollTop: z.number().min(0),
  viewportHeight: z.number().positive(),
  rowHeight: z.number().positive(),
  totalRows: z.number().int().min(0),
  overscanRows: z.number().int().min(0).max(100).default(6)
});
export type VirtualizedWindowRequest = z.infer<typeof VirtualizedWindowRequestSchema>;

export const VirtualizedWindowSchema = z.object({
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
  paddingTop: z.number().min(0),
  paddingBottom: z.number().min(0)
});
export type VirtualizedWindow = z.infer<typeof VirtualizedWindowSchema>;
