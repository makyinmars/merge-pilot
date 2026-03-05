import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  GitDiffRequestSchema,
  GitDiffResultSchema,
  GitOpenRepositoryRequestSchema,
  GitRepositorySchema,
  GitResolveRefRequestSchema,
  GitResolvedRefSchema,
  WORKING_TREE_REF,
  type GitAdapterErrorCode,
  type GitDiffFile,
  type GitDiffResult,
  type GitRefKind,
  type GitRefInput,
  type GitRepository,
  type GitResolvedRef
} from "@mergepilot/shared-types";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const SHA_1_HEX_PATTERN = /^[0-9a-f]{40}$/i;

interface GitExecutionError extends Error {
  code?: number | string;
  stderr?: string;
  stdout?: string;
}

interface NameStatusRecord {
  path: string;
  status: GitDiffFile["status"];
  oldPath?: string;
}

interface PatchRecord {
  path: string;
  additions: number;
  deletions: number;
  isBinary: boolean;
  patch: string;
  oldPath?: string;
}

interface ValidationErrorLike {
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>;
}

function isGitExecutionError(error: unknown): error is GitExecutionError {
  if (!(error instanceof Error)) {
    return false;
  }

  return "code" in error || "stderr" in error || "stdout" in error;
}

function formatValidationError(error: ValidationErrorLike): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function parseBooleanLiteral(input: string): boolean | null {
  if (input === "true") {
    return true;
  }

  if (input === "false") {
    return false;
  }

  return null;
}

function mapStatusCode(code: string): GitDiffFile["status"] {
  switch (code) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type-changed";
    case "U":
      return "unmerged";
    case "M":
    default:
      return "modified";
  }
}

function inferRefKind(inputRef: string, symbolicName?: string): GitRefKind {
  if (inputRef === WORKING_TREE_REF) {
    return "working-tree";
  }

  if (inputRef === "stash" || inputRef.startsWith("stash@{") || symbolicName === "refs/stash") {
    return "stash";
  }

  if (symbolicName?.startsWith("refs/heads/")) {
    return "branch";
  }

  if (symbolicName?.startsWith("refs/tags/")) {
    return "tag";
  }

  if (SHA_1_HEX_PATTERN.test(inputRef)) {
    return "commit";
  }

  if (symbolicName?.startsWith("refs/")) {
    return "unknown";
  }

  return "commit";
}

function parseNameStatusRecords(output: string): NameStatusRecord[] {
  if (output.length === 0) {
    return [];
  }

  const tokens = output.split("\0").filter((token) => token.length > 0);
  const records: NameStatusRecord[] = [];

  for (let index = 0; index < tokens.length; ) {
    const statusToken = tokens[index];
    if (!statusToken) {
      break;
    }
    index += 1;

    const statusCode = statusToken[0];
    if (!statusCode) {
      throw new Error("Encountered empty status code in git name-status output.");
    }

    if (statusCode === "R" || statusCode === "C") {
      const oldPath = tokens[index];
      const newPath = tokens[index + 1];
      if (!oldPath || !newPath) {
        throw new Error(`Missing rename/copy paths for status token "${statusToken}".`);
      }

      records.push({
        status: mapStatusCode(statusCode),
        path: newPath,
        oldPath
      });
      index += 2;
      continue;
    }

    const path = tokens[index];
    if (!path) {
      throw new Error(`Missing path for status token "${statusToken}".`);
    }

    records.push({
      status: mapStatusCode(statusCode),
      path
    });
    index += 1;
  }

  return records;
}

function decodePathToken(token: string): string {
  if (!(token.startsWith("\"") && token.endsWith("\""))) {
    return token;
  }

  const innerValue = token.slice(1, -1);
  return innerValue.replace(/\\([\\"])/g, "$1");
}

function parseDiffGitHeader(line: string): { oldPath: string; newPath: string } | null {
  const prefix = "diff --git ";
  if (!line.startsWith(prefix)) {
    return null;
  }

  const tokens = line
    .slice(prefix.length)
    .match(/"([^"\\]|\\.)*"|[^ ]+/g)
    ?.map((token) => decodePathToken(token));

  if (!tokens || tokens.length < 2) {
    return null;
  }

  const oldToken = tokens[0];
  const newToken = tokens[1];
  if (!oldToken || !newToken) {
    return null;
  }

  return {
    oldPath: oldToken.startsWith("a/") ? oldToken.slice(2) : oldToken,
    newPath: newToken.startsWith("b/") ? newToken.slice(2) : newToken
  };
}

function parsePatchRecords(output: string): Map<string, PatchRecord> {
  const records = new Map<string, PatchRecord>();
  if (output.length === 0) {
    return records;
  }

  const normalized = output.replace(/\r\n/g, "\n");
  const chunks = normalized.match(/diff --git [\s\S]*?(?=\ndiff --git |\s*$)/g);
  if (!chunks) {
    return records;
  }

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const header = parseDiffGitHeader(lines[0] ?? "");
    if (!header) {
      continue;
    }

    let additions = 0;
    let deletions = 0;
    let isBinary = false;
    let inHunk = false;
    let oldPathFromRename: string | undefined;

    for (const line of lines) {
      if (line.startsWith("rename from ")) {
        oldPathFromRename = decodePathToken(line.slice("rename from ".length).trim());
      } else if (line.startsWith("copy from ") && oldPathFromRename === undefined) {
        oldPathFromRename = decodePathToken(line.slice("copy from ".length).trim());
      }

      if (line.startsWith("Binary files ") || line === "GIT binary patch") {
        isBinary = true;
      }

      if (line.startsWith("@@")) {
        inHunk = true;
        continue;
      }

      if (!inHunk) {
        continue;
      }

      if (line.startsWith("+++ ") || line.startsWith("--- ")) {
        continue;
      }

      if (line.startsWith("+")) {
        additions += 1;
      } else if (line.startsWith("-")) {
        deletions += 1;
      }
    }

    const oldPath =
      oldPathFromRename && oldPathFromRename !== header.newPath
        ? oldPathFromRename
        : header.oldPath !== header.newPath
          ? header.oldPath
          : undefined;

    const patchRecord: PatchRecord = {
      path: header.newPath,
      additions,
      deletions,
      isBinary,
      patch: chunk.trimEnd()
    };

    if (oldPath) {
      patchRecord.oldPath = oldPath;
    }

    records.set(header.newPath, patchRecord);
  }

  return records;
}

function mergeRecords(
  statusRecords: NameStatusRecord[],
  patchRecords: Map<string, PatchRecord>,
  includePatch: boolean
): GitDiffFile[] {
  const merged: GitDiffFile[] = [];
  const consumedPatchKeys = new Set<string>();

  for (const statusRecord of statusRecords) {
    const patchRecord = patchRecords.get(statusRecord.path);
    if (patchRecord) {
      consumedPatchKeys.add(patchRecord.path);
    }

    const file: GitDiffFile = {
      path: statusRecord.path,
      status: statusRecord.status,
      additions: patchRecord?.additions ?? 0,
      deletions: patchRecord?.deletions ?? 0,
      isBinary: patchRecord?.isBinary ?? false
    };

    if (statusRecord.oldPath) {
      file.oldPath = statusRecord.oldPath;
    } else if (patchRecord?.oldPath && patchRecord.oldPath !== statusRecord.path) {
      file.oldPath = patchRecord.oldPath;
    }

    if (includePatch && patchRecord) {
      file.patch = patchRecord.patch;
    }

    merged.push(file);
  }

  for (const patchRecord of patchRecords.values()) {
    if (consumedPatchKeys.has(patchRecord.path)) {
      continue;
    }

    const file: GitDiffFile = {
      path: patchRecord.path,
      status: "modified",
      additions: patchRecord.additions,
      deletions: patchRecord.deletions,
      isBinary: patchRecord.isBinary
    };

    if (patchRecord.oldPath && patchRecord.oldPath !== patchRecord.path) {
      file.oldPath = patchRecord.oldPath;
    }

    if (includePatch) {
      file.patch = patchRecord.patch;
    }

    merged.push(file);
  }

  return merged.sort((left, right) => left.path.localeCompare(right.path));
}

function buildPathspecArgs(includePaths?: string[], excludePaths?: string[]): string[] {
  const pathspec: string[] = [];

  if (includePaths && includePaths.length > 0) {
    pathspec.push(...includePaths);
  } else if (excludePaths && excludePaths.length > 0) {
    pathspec.push(".");
  }

  if (excludePaths && excludePaths.length > 0) {
    for (const excludedPath of excludePaths) {
      pathspec.push(`:(exclude)${excludedPath}`);
    }
  }

  return pathspec;
}

function isRepositoryLookupFailure(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("not a git repository") ||
    lowered.includes("cannot change to") ||
    lowered.includes("no such file or directory")
  );
}

export class GitAdapterError extends Error {
  public readonly code: GitAdapterErrorCode;

  public constructor(code: GitAdapterErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GitAdapterError";
    this.code = code;
  }
}

export interface LocalGitAdapterOptions {
  gitBinaryPath?: string;
}

export class LocalGitAdapter {
  private readonly gitBinaryPath: string;

  public constructor(options: LocalGitAdapterOptions = {}) {
    this.gitBinaryPath = options.gitBinaryPath ?? "git";
  }

  public async openRepository(requestInput: unknown): Promise<GitRepository> {
    const parsedRequest = GitOpenRepositoryRequestSchema.safeParse(requestInput);
    if (!parsedRequest.success) {
      throw new GitAdapterError(
        "INVALID_REQUEST",
        `Open repository request failed validation: ${formatValidationError(parsedRequest.error)}`,
        { cause: parsedRequest.error }
      );
    }

    let revParseOutput: string;
    try {
      revParseOutput = await this.runGit(parsedRequest.data.repositoryPath, [
        "rev-parse",
        "--show-toplevel",
        "--absolute-git-dir",
        "--is-bare-repository"
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open repository.";
      if (isRepositoryLookupFailure(message)) {
        throw new GitAdapterError(
          "INVALID_REPOSITORY",
          `Path is not a valid Git repository: ${parsedRequest.data.repositoryPath}`,
          { cause: error instanceof Error ? error : undefined }
        );
      }

      throw error;
    }

    const lines = revParseOutput.trim().split(/\r?\n/);
    const rootPath = lines[0];
    const gitDir = lines[1];
    const bareLiteral = lines[2];

    if (!rootPath || !gitDir || !bareLiteral) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        "git rev-parse returned an unexpected response while opening repository."
      );
    }

    const isBare = parseBooleanLiteral(bareLiteral);
    if (isBare === null) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        `Unexpected boolean literal from git rev-parse: "${bareLiteral}".`
      );
    }

    const [defaultBranch, headRef] = await Promise.all([
      this.readDefaultBranch(rootPath),
      this.readHeadRef(rootPath)
    ]);

    const repositoryResult = GitRepositorySchema.safeParse({
      repositoryPath: parsedRequest.data.repositoryPath,
      rootPath,
      gitDir,
      isBare,
      defaultBranch,
      headRef
    });

    if (!repositoryResult.success) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        `Repository metadata did not match expected schema: ${formatValidationError(repositoryResult.error)}`,
        { cause: repositoryResult.error }
      );
    }

    return repositoryResult.data;
  }

  public async resolveRef(requestInput: unknown): Promise<GitResolvedRef> {
    const parsedRequest = GitResolveRefRequestSchema.safeParse(requestInput);
    if (!parsedRequest.success) {
      throw new GitAdapterError(
        "INVALID_REQUEST",
        `Resolve ref request failed validation: ${formatValidationError(parsedRequest.error)}`,
        { cause: parsedRequest.error }
      );
    }

    const repository = await this.openRepository({
      repositoryPath: parsedRequest.data.repositoryPath
    });

    return this.resolveRefInRepository(repository.rootPath, parsedRequest.data.ref);
  }

  public async generateDiff(requestInput: unknown): Promise<GitDiffResult> {
    const parsedRequest = GitDiffRequestSchema.safeParse(requestInput);
    if (!parsedRequest.success) {
      throw new GitAdapterError(
        "INVALID_REQUEST",
        `Generate diff request failed validation: ${formatValidationError(parsedRequest.error)}`,
        { cause: parsedRequest.error }
      );
    }

    const request = parsedRequest.data;
    if (request.baseRef === WORKING_TREE_REF) {
      throw new GitAdapterError(
        "INVALID_REQUEST",
        "baseRef cannot be WORKING_TREE; use a concrete commit-ish reference for the base."
      );
    }

    const repository = await this.openRepository({
      repositoryPath: request.repositoryPath
    });

    const baseResolved = await this.resolveRefInRepository(repository.rootPath, request.baseRef);
    const headResolved =
      request.headRef === WORKING_TREE_REF
        ? GitResolvedRefSchema.parse({
            input: WORKING_TREE_REF,
            normalized: WORKING_TREE_REF,
            kind: "working-tree"
          })
        : await this.resolveRefInRepository(repository.rootPath, request.headRef);

    const pathspecArgs = buildPathspecArgs(request.includePaths, request.excludePaths);
    const comparisonArgs =
      headResolved.normalized === WORKING_TREE_REF
        ? [baseResolved.normalized]
        : [baseResolved.normalized, headResolved.normalized];

    const nameStatusCommand = ["diff", "--find-renames", "--name-status", "-z", ...comparisonArgs];
    if (pathspecArgs.length > 0) {
      nameStatusCommand.push("--", ...pathspecArgs);
    }

    const patchContextLines = request.includePatch ? request.contextLines : 0;
    const patchCommand = [
      "diff",
      "--find-renames",
      "--no-color",
      "--no-ext-diff",
      `--unified=${patchContextLines}`,
      ...comparisonArgs
    ];
    if (pathspecArgs.length > 0) {
      patchCommand.push("--", ...pathspecArgs);
    }

    const [nameStatusOutput, patchOutput] = await Promise.all([
      this.runGit(repository.rootPath, nameStatusCommand),
      this.runGit(repository.rootPath, patchCommand)
    ]);

    let statusRecords: NameStatusRecord[];
    let patchRecords: Map<string, PatchRecord>;

    try {
      statusRecords = parseNameStatusRecords(nameStatusOutput);
      patchRecords = parsePatchRecords(patchOutput);
    } catch (error) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        "Git diff output could not be parsed into MergePilot diff metadata.",
        { cause: error instanceof Error ? error : undefined }
      );
    }

    const files = mergeRecords(statusRecords, patchRecords, request.includePatch);
    const result = GitDiffResultSchema.safeParse({
      repositoryPath: repository.rootPath,
      baseRef: baseResolved.normalized,
      headRef: headResolved.normalized,
      comparedAt: new Date().toISOString(),
      files
    });

    if (!result.success) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        `Generated diff result did not match schema: ${formatValidationError(result.error)}`,
        { cause: result.error }
      );
    }

    return result.data;
  }

  private async resolveRefInRepository(
    repositoryPath: string,
    refInput: GitRefInput
  ): Promise<GitResolvedRef> {
    if (refInput === WORKING_TREE_REF) {
      return GitResolvedRefSchema.parse({
        input: WORKING_TREE_REF,
        normalized: WORKING_TREE_REF,
        kind: "working-tree"
      });
    }

    const objectIdOutput = await this.runGitOptional(repositoryPath, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${refInput}^{commit}`
    ]);

    if (!objectIdOutput) {
      throw new GitAdapterError("INVALID_REF", `Unable to resolve Git ref "${refInput}".`);
    }

    const objectId = objectIdOutput.trim();
    if (!SHA_1_HEX_PATTERN.test(objectId)) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        `Resolved object ID for ref "${refInput}" was not a full SHA-1 hash.`
      );
    }

    const symbolicNameOutput = await this.runGitOptional(repositoryPath, [
      "rev-parse",
      "--symbolic-full-name",
      "--verify",
      "--quiet",
      refInput
    ]);

    const symbolicName = symbolicNameOutput?.trim() || undefined;
    const kind = inferRefKind(refInput, symbolicName);
    const normalized = symbolicName ?? objectId;

    const resolvedRef = GitResolvedRefSchema.safeParse({
      input: refInput,
      normalized,
      kind,
      objectId,
      symbolicName
    });

    if (!resolvedRef.success) {
      throw new GitAdapterError(
        "INVALID_RESPONSE",
        `Resolved ref payload did not match schema: ${formatValidationError(resolvedRef.error)}`,
        { cause: resolvedRef.error }
      );
    }

    return resolvedRef.data;
  }

  private async readDefaultBranch(repositoryPath: string): Promise<string | undefined> {
    const remoteHead = await this.runGitOptional(repositoryPath, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "refs/remotes/origin/HEAD"
    ]);
    const remoteBranch = remoteHead?.trim();
    if (remoteBranch) {
      return remoteBranch.replace(/^origin\//, "");
    }

    const localHead = await this.runGitOptional(repositoryPath, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD"
    ]);
    const localBranch = localHead?.trim();
    return localBranch || undefined;
  }

  private async readHeadRef(repositoryPath: string): Promise<string | undefined> {
    const symbolicHead = await this.runGitOptional(repositoryPath, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD"
    ]);
    const symbolicValue = symbolicHead?.trim();
    if (symbolicValue) {
      return symbolicValue;
    }

    const detachedHead = await this.runGitOptional(repositoryPath, [
      "rev-parse",
      "--short",
      "HEAD"
    ]);
    return detachedHead?.trim() || undefined;
  }

  private async runGit(repositoryPath: string, args: string[]): Promise<string> {
    const result = await this.executeGit(repositoryPath, args, false);
    return result.stdout;
  }

  private async runGitOptional(repositoryPath: string, args: string[]): Promise<string | undefined> {
    const result = await this.executeGit(repositoryPath, args, true);
    if (result.exitCode !== 0) {
      return undefined;
    }

    return result.stdout;
  }

  private async executeGit(
    repositoryPath: string,
    args: string[],
    allowFailure: boolean
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    try {
      const result = await execFileAsync(this.gitBinaryPath, ["-C", repositoryPath, ...args], {
        encoding: "utf8",
        maxBuffer: DEFAULT_MAX_BUFFER_BYTES
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error) {
      if (!isGitExecutionError(error)) {
        throw error;
      }

      if (allowFailure && typeof error.code === "number") {
        return {
          stdout: error.stdout ?? "",
          stderr: error.stderr ?? "",
          exitCode: error.code
        };
      }

      const stderr = error.stderr?.trim();
      const message = stderr && stderr.length > 0 ? stderr : error.message;
      throw new GitAdapterError("COMMAND_FAILED", `git ${args.join(" ")} failed: ${message}`, {
        cause: error
      });
    }
  }
}
