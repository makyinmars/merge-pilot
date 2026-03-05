import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LocalGitAdapter } from "@mergepilot/git-adapter";
import { buildDiffViews } from "@mergepilot/review-ux";
import {
  DefaultRepositoryPathResponseSchema,
  IPC_CHANNELS,
  LoadReviewSessionRequestSchema,
  LoadReviewSessionResponseSchema,
  type ReviewFileView
} from "./ipc-contracts.js";

interface ValidationErrorLike {
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>;
}

const ENTRY_FILE_PATH = fileURLToPath(import.meta.url);
const ENTRY_DIRECTORY_PATH = dirname(ENTRY_FILE_PATH);
const PRELOAD_FILE_PATH = join(ENTRY_DIRECTORY_PATH, "preload.js");
const INDEX_FILE_PATH = join(ENTRY_DIRECTORY_PATH, "index.html");

const gitAdapter = new LocalGitAdapter();

function formatValidationError(error: ValidationErrorLike): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function buildFileView(file: ReviewFileView["file"], languageHint?: string): ReviewFileView {
  if (file.isBinary || !file.patch || file.patch.length === 0) {
    return { file };
  }

  try {
    return {
      file,
      views: buildDiffViews({
        file,
        languageHint
      })
    };
  } catch (error) {
    return {
      file,
      renderError: `Unable to build diff views: ${toErrorMessage(error)}`
    };
  }
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1580,
    height: 980,
    minWidth: 1120,
    minHeight: 680,
    title: "MergePilot",
    autoHideMenuBar: true,
    backgroundColor: "#f4efe6",
    webPreferences: {
      preload: PRELOAD_FILE_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  void mainWindow.loadFile(INDEX_FILE_PATH);
  return mainWindow;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getDefaultRepositoryPath, async () =>
    DefaultRepositoryPathResponseSchema.parse({
      repositoryPath: process.cwd()
    })
  );

  ipcMain.handle(IPC_CHANNELS.loadReviewSession, async (_event, requestInput) => {
    const parsedRequest = LoadReviewSessionRequestSchema.safeParse(requestInput);
    if (!parsedRequest.success) {
      throw new Error(`Invalid review session request: ${formatValidationError(parsedRequest.error)}`);
    }

    const request = parsedRequest.data;
    const repository = await gitAdapter.openRepository({
      repositoryPath: request.repositoryPath
    });

    const diff = await gitAdapter.generateDiff({
      repositoryPath: repository.rootPath,
      baseRef: request.baseRef,
      headRef: request.headRef,
      contextLines: request.contextLines,
      includePaths: request.includePaths,
      excludePaths: request.excludePaths,
      includePatch: true
    });

    const files = diff.files.map((file) => buildFileView(file, request.languageHint));
    const parsedResponse = LoadReviewSessionResponseSchema.safeParse({
      repository,
      diff,
      files
    });

    if (!parsedResponse.success) {
      throw new Error(`Invalid review session response: ${formatValidationError(parsedResponse.error)}`);
    }

    return parsedResponse.data;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
