import { extname } from "node:path";
import {
  BuildDiffViewRequestSchema,
  BuildHunkNavigationRequestSchema,
  HunkNavigationSchema,
  ReviewCodeLanguageSchema,
  SplitDiffViewModelSchema,
  UnifiedDiffViewModelSchema,
  VirtualizedWindowRequestSchema,
  VirtualizedWindowSchema,
  type DiffHunk,
  type DiffHunkLine,
  type DiffSyntaxToken,
  type ReviewCodeLanguage,
  type SplitDiffCell,
  type SplitDiffViewModel,
  type UnifiedDiffViewModel,
  type VirtualizedWindow
} from "@mergepilot/shared-types";

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:\s(.*))?$/;
const TOKEN_PATTERN =
  /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|==|!=|<=|>=|&&|\|\||=>|[-+*/%=&|^!<>]+|[()[\]{}.,;:?]|[A-Za-z_][A-Za-z0-9_]*|\s+|.)/g;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMBER_PATTERN = /^\d+(?:\.\d+)?$/;
const OPERATOR_PATTERN = /^(==|!=|<=|>=|&&|\|\||=>|[-+*/%=&|^!<>]+)$/;
const PUNCTUATION_PATTERN = /^[()[\]{}.,;:?]$/;
const WHITESPACE_PATTERN = /^\s+$/;

const EXTENSION_LANGUAGE_MAP: Record<string, ReviewCodeLanguage> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".json": "json",
  ".md": "markdown",
  ".mdx": "markdown",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".c": "c",
  ".cs": "csharp",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".yml": "yaml",
  ".yaml": "yaml"
};

const LANGUAGE_HINT_MAP: Record<string, ReviewCodeLanguage> = {
  plaintext: "plain-text",
  "plain-text": "plain-text",
  text: "plain-text",
  ts: "typescript",
  typescript: "typescript",
  js: "javascript",
  javascript: "javascript",
  tsx: "tsx",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  python: "python",
  go: "go",
  rust: "rust",
  rs: "rust",
  java: "java",
  kotlin: "kotlin",
  kt: "kotlin",
  swift: "swift",
  cpp: "cpp",
  cxx: "cpp",
  c: "c",
  csharp: "csharp",
  "c#": "csharp",
  css: "css",
  html: "html",
  shell: "shell",
  sh: "shell",
  bash: "shell",
  yaml: "yaml",
  yml: "yaml"
};

const LANGUAGE_KEYWORDS: Record<ReviewCodeLanguage, ReadonlySet<string>> = {
  "plain-text": new Set(),
  typescript: new Set([
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "private",
    "protected",
    "public",
    "readonly",
    "return",
    "static",
    "switch",
    "throw",
    "true",
    "try",
    "type",
    "undefined",
    "var",
    "void",
    "while"
  ]),
  javascript: new Set([
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "null",
    "return",
    "switch",
    "throw",
    "true",
    "try",
    "undefined",
    "var",
    "while"
  ]),
  tsx: new Set(["const", "export", "function", "if", "import", "interface", "let", "return", "type"]),
  jsx: new Set(["const", "export", "function", "if", "import", "let", "return"]),
  json: new Set(["false", "null", "true"]),
  markdown: new Set(),
  python: new Set([
    "and",
    "as",
    "class",
    "def",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with"
  ]),
  go: new Set([
    "break",
    "case",
    "chan",
    "const",
    "continue",
    "default",
    "defer",
    "else",
    "fallthrough",
    "for",
    "func",
    "go",
    "if",
    "import",
    "interface",
    "map",
    "package",
    "range",
    "return",
    "select",
    "struct",
    "switch",
    "type",
    "var"
  ]),
  rust: new Set([
    "as",
    "async",
    "await",
    "break",
    "const",
    "continue",
    "crate",
    "else",
    "enum",
    "extern",
    "false",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "match",
    "mod",
    "move",
    "mut",
    "pub",
    "return",
    "self",
    "static",
    "struct",
    "trait",
    "true",
    "type",
    "unsafe",
    "use",
    "where",
    "while"
  ]),
  java: new Set([
    "abstract",
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "for",
    "if",
    "implements",
    "import",
    "instanceof",
    "interface",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "void",
    "while"
  ]),
  kotlin: new Set([
    "as",
    "break",
    "class",
    "companion",
    "const",
    "continue",
    "data",
    "else",
    "false",
    "for",
    "fun",
    "if",
    "import",
    "in",
    "interface",
    "is",
    "null",
    "object",
    "override",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "sealed",
    "super",
    "this",
    "true",
    "try",
    "typealias",
    "val",
    "var",
    "when",
    "while"
  ]),
  swift: new Set([
    "actor",
    "as",
    "break",
    "case",
    "class",
    "continue",
    "default",
    "defer",
    "do",
    "else",
    "enum",
    "extension",
    "false",
    "for",
    "func",
    "guard",
    "if",
    "import",
    "in",
    "let",
    "nil",
    "protocol",
    "public",
    "return",
    "self",
    "static",
    "struct",
    "switch",
    "throw",
    "true",
    "try",
    "var",
    "where",
    "while"
  ]),
  cpp: new Set([
    "auto",
    "bool",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "else",
    "enum",
    "false",
    "for",
    "if",
    "inline",
    "namespace",
    "new",
    "nullptr",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "struct",
    "switch",
    "template",
    "this",
    "throw",
    "true",
    "try",
    "using",
    "virtual",
    "void",
    "while"
  ]),
  c: new Set([
    "auto",
    "break",
    "case",
    "char",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extern",
    "float",
    "for",
    "if",
    "inline",
    "int",
    "long",
    "register",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "typedef",
    "union",
    "unsigned",
    "void",
    "volatile",
    "while"
  ]),
  csharp: new Set([
    "abstract",
    "async",
    "await",
    "bool",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "else",
    "enum",
    "false",
    "finally",
    "for",
    "if",
    "interface",
    "namespace",
    "new",
    "null",
    "private",
    "protected",
    "public",
    "return",
    "sealed",
    "static",
    "struct",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "using",
    "var",
    "void",
    "while"
  ]),
  css: new Set(["import", "media", "supports"]),
  html: new Set(),
  shell: new Set([
    "case",
    "do",
    "done",
    "elif",
    "else",
    "esac",
    "fi",
    "for",
    "function",
    "if",
    "in",
    "then",
    "until",
    "while"
  ]),
  yaml: new Set(["false", "null", "true", "yes", "no", "on", "off"])
};

interface ValidationErrorLike {
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>;
}

interface ParsedPatch {
  fileMetaLines: string[];
  hunks: DiffHunk[];
}

interface MutableHunk {
  index: number;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  oldCursor: number;
  newCursor: number;
  lines: DiffHunkLine[];
}

export type ReviewUxErrorCode = "INVALID_REQUEST" | "INVALID_RESPONSE" | "PATCH_PARSE_FAILED";

export class ReviewUxError extends Error {
  public readonly code: ReviewUxErrorCode;

  public constructor(code: ReviewUxErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReviewUxError";
    this.code = code;
  }
}

function formatValidationError(error: ValidationErrorLike): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function normalizeLanguageHint(languageHint?: string): ReviewCodeLanguage | undefined {
  if (!languageHint) {
    return undefined;
  }

  const normalized = languageHint.trim().toLowerCase();
  const mapped = LANGUAGE_HINT_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  const parsed = ReviewCodeLanguageSchema.safeParse(normalized);
  if (!parsed.success) {
    return undefined;
  }

  return parsed.data;
}

function detectLanguage(filePath: string, languageHint?: string): ReviewCodeLanguage {
  const hint = normalizeLanguageHint(languageHint);
  if (hint) {
    return hint;
  }

  const extension = extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[extension] ?? "plain-text";
}

function isCommentLine(trimmed: string, language: ReviewCodeLanguage): boolean {
  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return true;
  }

  if (language === "python" || language === "shell" || language === "yaml") {
    return trimmed.startsWith("#");
  }

  return false;
}

function classifyToken(token: string, language: ReviewCodeLanguage): DiffSyntaxToken["kind"] {
  if (WHITESPACE_PATTERN.test(token)) {
    return "plain";
  }

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith("`") && token.endsWith("`"))
  ) {
    return "string";
  }

  if (NUMBER_PATTERN.test(token)) {
    return "number";
  }

  if (OPERATOR_PATTERN.test(token)) {
    return "operator";
  }

  if (PUNCTUATION_PATTERN.test(token)) {
    return "punctuation";
  }

  if (IDENTIFIER_PATTERN.test(token)) {
    if (LANGUAGE_KEYWORDS[language].has(token)) {
      return "keyword";
    }

    return "identifier";
  }

  return "plain";
}

function tokenizeCodeLine(content: string, language: ReviewCodeLanguage): DiffSyntaxToken[] {
  if (content.length === 0) {
    return [];
  }

  if (language === "plain-text") {
    return [{ kind: "plain", text: content }];
  }

  const trimmed = content.trimStart();
  if (isCommentLine(trimmed, language)) {
    return [{ kind: "comment", text: content }];
  }

  const matches = content.match(TOKEN_PATTERN);
  if (!matches || matches.length === 0) {
    return [{ kind: "plain", text: content }];
  }

  return matches.map((token) => ({
    kind: classifyToken(token, language),
    text: token
  }));
}

function createDiffLine(
  lineType: DiffHunkLine["lineType"],
  symbol: DiffHunkLine["symbol"],
  content: string,
  language: ReviewCodeLanguage,
  oldLineNumber?: number,
  newLineNumber?: number
): DiffHunkLine {
  const line: DiffHunkLine = {
    lineType,
    symbol,
    content,
    tokens: lineType === "meta" ? [] : tokenizeCodeLine(content, language)
  };

  if (oldLineNumber !== undefined) {
    line.oldLineNumber = oldLineNumber;
  }

  if (newLineNumber !== undefined) {
    line.newLineNumber = newLineNumber;
  }

  return line;
}

function flushHunk(target: DiffHunk[], hunk?: MutableHunk): void {
  if (!hunk) {
    return;
  }

  target.push({
    index: hunk.index,
    header: hunk.header,
    oldStart: hunk.oldStart,
    oldLines: hunk.oldLines,
    newStart: hunk.newStart,
    newLines: hunk.newLines,
    lines: hunk.lines
  });
}

function parsePatch(patch: string | undefined, language: ReviewCodeLanguage): ParsedPatch {
  const parsed: ParsedPatch = {
    fileMetaLines: [],
    hunks: []
  };

  if (!patch || patch.length === 0) {
    return parsed;
  }

  const normalizedPatch = patch.replace(/\r\n/g, "\n");
  const lines = normalizedPatch.endsWith("\n")
    ? normalizedPatch.slice(0, -1).split("\n")
    : normalizedPatch.split("\n");

  let activeHunk: MutableHunk | undefined;
  let hunkIndex = 0;

  for (const line of lines) {
    const headerMatch = HUNK_HEADER_PATTERN.exec(line);
    if (headerMatch) {
      flushHunk(parsed.hunks, activeHunk);

      const oldStart = Number.parseInt(headerMatch[1] ?? "", 10);
      const oldLines = Number.parseInt(headerMatch[2] ?? "1", 10);
      const newStart = Number.parseInt(headerMatch[3] ?? "", 10);
      const newLines = Number.parseInt(headerMatch[4] ?? "1", 10);

      if (
        !Number.isInteger(oldStart) ||
        !Number.isInteger(oldLines) ||
        !Number.isInteger(newStart) ||
        !Number.isInteger(newLines) ||
        oldStart < 0 ||
        oldLines < 0 ||
        newStart < 0 ||
        newLines < 0
      ) {
        throw new ReviewUxError(
          "PATCH_PARSE_FAILED",
          `Unable to parse diff hunk header: ${line}`
        );
      }

      activeHunk = {
        index: hunkIndex,
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        oldCursor: oldStart,
        newCursor: newStart,
        lines: []
      };

      hunkIndex += 1;
      continue;
    }

    if (!activeHunk) {
      if (line.length > 0) {
        parsed.fileMetaLines.push(line);
      }
      continue;
    }

    if (line.startsWith("+")) {
      activeHunk.lines.push(
        createDiffLine("addition", "+", line.slice(1), language, undefined, activeHunk.newCursor)
      );
      activeHunk.newCursor += 1;
      continue;
    }

    if (line.startsWith("-")) {
      activeHunk.lines.push(
        createDiffLine("deletion", "-", line.slice(1), language, activeHunk.oldCursor)
      );
      activeHunk.oldCursor += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      activeHunk.lines.push(
        createDiffLine(
          "context",
          " ",
          line.slice(1),
          language,
          activeHunk.oldCursor,
          activeHunk.newCursor
        )
      );
      activeHunk.oldCursor += 1;
      activeHunk.newCursor += 1;
      continue;
    }

    if (line.startsWith("\\ No newline at end of file")) {
      activeHunk.lines.push(createDiffLine("meta", "\\", line, language));
      continue;
    }

    activeHunk.lines.push(createDiffLine("meta", " ", line, language));
  }

  flushHunk(parsed.hunks, activeHunk);
  return parsed;
}

function buildSplitCell(line: DiffHunkLine, side: "left" | "right"): SplitDiffCell {
  const cell: SplitDiffCell = {
    lineType: line.lineType,
    text: line.content,
    tokens: line.tokens
  };

  const lineNumber = side === "left" ? line.oldLineNumber : line.newLineNumber;
  if (lineNumber !== undefined) {
    cell.lineNumber = lineNumber;
  }

  return cell;
}

export function buildUnifiedDiffViewModel(requestInput: unknown): UnifiedDiffViewModel {
  const parsedRequest = BuildDiffViewRequestSchema.safeParse(requestInput);
  if (!parsedRequest.success) {
    throw new ReviewUxError(
      "INVALID_REQUEST",
      `Unified diff request failed validation: ${formatValidationError(parsedRequest.error)}`,
      { cause: parsedRequest.error }
    );
  }

  const { file, languageHint } = parsedRequest.data;
  const language = detectLanguage(file.path, languageHint);
  const parsedPatch = parsePatch(file.patch, language);

  const rows: UnifiedDiffViewModel["rows"] = [];
  const hunkRowOffsets: number[] = [];

  let rowCounter = 0;
  for (const metaLine of parsedPatch.fileMetaLines) {
    rows.push({
      id: `${file.path}:u:${rowCounter}`,
      rowType: "file-meta",
      text: metaLine
    });
    rowCounter += 1;
  }

  for (const hunk of parsedPatch.hunks) {
    hunkRowOffsets.push(rows.length);
    rows.push({
      id: `${file.path}:u:${rowCounter}`,
      rowType: "hunk-header",
      hunkIndex: hunk.index,
      text: hunk.header
    });
    rowCounter += 1;

    hunk.lines.forEach((line, lineIndex) => {
      rows.push({
        id: `${file.path}:u:${rowCounter}`,
        rowType: "diff-line",
        hunkIndex: hunk.index,
        lineIndex,
        line
      });
      rowCounter += 1;
    });
  }

  const parsedResult = UnifiedDiffViewModelSchema.safeParse({
    file,
    language,
    fileMetaLines: parsedPatch.fileMetaLines,
    hunks: parsedPatch.hunks,
    rows,
    hunkRowOffsets,
    totalRows: rows.length
  });

  if (!parsedResult.success) {
    throw new ReviewUxError(
      "INVALID_RESPONSE",
      `Unified diff model failed validation: ${formatValidationError(parsedResult.error)}`,
      { cause: parsedResult.error }
    );
  }

  return parsedResult.data;
}

export function buildSplitDiffViewModel(requestInput: unknown): SplitDiffViewModel {
  const parsedRequest = BuildDiffViewRequestSchema.safeParse(requestInput);
  if (!parsedRequest.success) {
    throw new ReviewUxError(
      "INVALID_REQUEST",
      `Split diff request failed validation: ${formatValidationError(parsedRequest.error)}`,
      { cause: parsedRequest.error }
    );
  }

  const { file, languageHint } = parsedRequest.data;
  const language = detectLanguage(file.path, languageHint);
  const parsedPatch = parsePatch(file.patch, language);

  const rows: SplitDiffViewModel["rows"] = [];
  const hunkRowOffsets: number[] = [];

  let rowCounter = 0;
  for (const metaLine of parsedPatch.fileMetaLines) {
    rows.push({
      id: `${file.path}:s:${rowCounter}`,
      rowType: "file-meta",
      text: metaLine
    });
    rowCounter += 1;
  }

  for (const hunk of parsedPatch.hunks) {
    hunkRowOffsets.push(rows.length);
    rows.push({
      id: `${file.path}:s:${rowCounter}`,
      rowType: "hunk-header",
      hunkIndex: hunk.index,
      text: hunk.header
    });
    rowCounter += 1;

    for (let lineIndex = 0; lineIndex < hunk.lines.length; ) {
      const current = hunk.lines[lineIndex];
      if (!current) {
        break;
      }

      if (current.lineType === "context") {
        rows.push({
          id: `${file.path}:s:${rowCounter}`,
          rowType: "diff-line",
          hunkIndex: hunk.index,
          left: buildSplitCell(current, "left"),
          right: buildSplitCell(current, "right")
        });
        rowCounter += 1;
        lineIndex += 1;
        continue;
      }

      if (current.lineType === "meta") {
        rows.push({
          id: `${file.path}:s:${rowCounter}`,
          rowType: "diff-line",
          hunkIndex: hunk.index,
          left: buildSplitCell(current, "left"),
          right: buildSplitCell(current, "right")
        });
        rowCounter += 1;
        lineIndex += 1;
        continue;
      }

      const deletedLines: DiffHunkLine[] = [];
      const addedLines: DiffHunkLine[] = [];

      while (lineIndex < hunk.lines.length && hunk.lines[lineIndex]?.lineType === "deletion") {
        const deletionLine = hunk.lines[lineIndex];
        if (deletionLine) {
          deletedLines.push(deletionLine);
        }
        lineIndex += 1;
      }

      while (lineIndex < hunk.lines.length && hunk.lines[lineIndex]?.lineType === "addition") {
        const additionLine = hunk.lines[lineIndex];
        if (additionLine) {
          addedLines.push(additionLine);
        }
        lineIndex += 1;
      }

      if (deletedLines.length === 0 && addedLines.length === 0) {
        lineIndex += 1;
        continue;
      }

      const pairedCount = Math.max(deletedLines.length, addedLines.length);
      for (let pairIndex = 0; pairIndex < pairedCount; pairIndex += 1) {
        const row: SplitDiffViewModel["rows"][number] = {
          id: `${file.path}:s:${rowCounter}`,
          rowType: "diff-line",
          hunkIndex: hunk.index
        };

        const deletedLine = deletedLines[pairIndex];
        const addedLine = addedLines[pairIndex];

        if (deletedLine) {
          row.left = buildSplitCell(deletedLine, "left");
        }

        if (addedLine) {
          row.right = buildSplitCell(addedLine, "right");
        }

        rows.push(row);
        rowCounter += 1;
      }
    }
  }

  const parsedResult = SplitDiffViewModelSchema.safeParse({
    file,
    language,
    fileMetaLines: parsedPatch.fileMetaLines,
    hunks: parsedPatch.hunks,
    rows,
    hunkRowOffsets,
    totalRows: rows.length
  });

  if (!parsedResult.success) {
    throw new ReviewUxError(
      "INVALID_RESPONSE",
      `Split diff model failed validation: ${formatValidationError(parsedResult.error)}`,
      { cause: parsedResult.error }
    );
  }

  return parsedResult.data;
}

export function buildHunkNavigation(requestInput: unknown) {
  const parsedRequest = BuildHunkNavigationRequestSchema.safeParse(requestInput);
  if (!parsedRequest.success) {
    throw new ReviewUxError(
      "INVALID_REQUEST",
      `Hunk navigation request failed validation: ${formatValidationError(parsedRequest.error)}`,
      { cause: parsedRequest.error }
    );
  }

  const { mode, hunkRowOffsets, currentRowIndex } = parsedRequest.data;
  const anchors = hunkRowOffsets.map((rowIndex, hunkIndex) => ({
    id: `${mode}-hunk-${hunkIndex}`,
    hunkIndex,
    rowIndex,
    label: `Hunk ${hunkIndex + 1}`
  }));

  let activeHunkIndex: number | undefined;
  let nextRowIndex: number | undefined;
  let previousRowIndex: number | undefined;

  if (currentRowIndex !== undefined) {
    for (const anchor of anchors) {
      if (anchor.rowIndex <= currentRowIndex) {
        activeHunkIndex = anchor.hunkIndex;
      }

      if (anchor.rowIndex < currentRowIndex) {
        previousRowIndex = anchor.rowIndex;
      }

      if (anchor.rowIndex > currentRowIndex && nextRowIndex === undefined) {
        nextRowIndex = anchor.rowIndex;
      }
    }
  } else {
    const firstAnchor = anchors[0];
    if (firstAnchor) {
      nextRowIndex = firstAnchor.rowIndex;
    }
  }

  const navigationInput: {
    mode: (typeof mode);
    anchors: typeof anchors;
    activeHunkIndex?: number;
    nextRowIndex?: number;
    previousRowIndex?: number;
  } = {
    mode,
    anchors
  };

  if (activeHunkIndex !== undefined) {
    navigationInput.activeHunkIndex = activeHunkIndex;
  }

  if (nextRowIndex !== undefined) {
    navigationInput.nextRowIndex = nextRowIndex;
  }

  if (previousRowIndex !== undefined) {
    navigationInput.previousRowIndex = previousRowIndex;
  }

  const parsedResult = HunkNavigationSchema.safeParse(navigationInput);
  if (!parsedResult.success) {
    throw new ReviewUxError(
      "INVALID_RESPONSE",
      `Hunk navigation response failed validation: ${formatValidationError(parsedResult.error)}`,
      { cause: parsedResult.error }
    );
  }

  return parsedResult.data;
}

export function calculateVirtualizedWindow(requestInput: unknown): VirtualizedWindow {
  const parsedRequest = VirtualizedWindowRequestSchema.safeParse(requestInput);
  if (!parsedRequest.success) {
    throw new ReviewUxError(
      "INVALID_REQUEST",
      `Virtualization request failed validation: ${formatValidationError(parsedRequest.error)}`,
      { cause: parsedRequest.error }
    );
  }

  const request = parsedRequest.data;
  if (request.totalRows === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0
    };
  }

  const firstVisibleIndex = Math.floor(request.scrollTop / request.rowHeight);
  const visibleRows = Math.max(1, Math.ceil(request.viewportHeight / request.rowHeight));
  const startIndex = Math.max(0, firstVisibleIndex - request.overscanRows);
  const endIndex = Math.min(request.totalRows, firstVisibleIndex + visibleRows + request.overscanRows);

  const parsedResult = VirtualizedWindowSchema.safeParse({
    startIndex,
    endIndex,
    paddingTop: startIndex * request.rowHeight,
    paddingBottom: Math.max(0, (request.totalRows - endIndex) * request.rowHeight)
  });

  if (!parsedResult.success) {
    throw new ReviewUxError(
      "INVALID_RESPONSE",
      `Virtualization response failed validation: ${formatValidationError(parsedResult.error)}`,
      { cause: parsedResult.error }
    );
  }

  return parsedResult.data;
}

export function buildDiffViews(requestInput: unknown): {
  unified: UnifiedDiffViewModel;
  split: SplitDiffViewModel;
  navigation: {
    unified: ReturnType<typeof buildHunkNavigation>;
    split: ReturnType<typeof buildHunkNavigation>;
  };
} {
  const unified = buildUnifiedDiffViewModel(requestInput);
  const split = buildSplitDiffViewModel(requestInput);

  return {
    unified,
    split,
    navigation: {
      unified: buildHunkNavigation({
        mode: "unified",
        hunkRowOffsets: unified.hunkRowOffsets
      }),
      split: buildHunkNavigation({
        mode: "split",
        hunkRowOffsets: split.hunkRowOffsets
      })
    }
  };
}
