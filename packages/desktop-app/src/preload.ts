import { contextBridge, ipcRenderer } from "electron";
import {
  DefaultRepositoryPathResponseSchema,
  IPC_CHANNELS,
  LoadReviewSessionRequestSchema,
  LoadReviewSessionResponseSchema,
  type MergePilotBridge
} from "./ipc-contracts.js";

interface ValidationErrorLike {
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>;
}

function formatValidationError(error: ValidationErrorLike): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

const bridge: MergePilotBridge = {
  async getDefaultRepositoryPath() {
    const rawResponse = await ipcRenderer.invoke(IPC_CHANNELS.getDefaultRepositoryPath);
    const parsedResponse = DefaultRepositoryPathResponseSchema.safeParse(rawResponse);

    if (!parsedResponse.success) {
      throw new Error(
        `Invalid default repository response payload: ${formatValidationError(parsedResponse.error)}`
      );
    }

    return parsedResponse.data;
  },

  async loadReviewSession(requestInput) {
    const parsedRequest = LoadReviewSessionRequestSchema.safeParse(requestInput);
    if (!parsedRequest.success) {
      throw new Error(`Invalid review request payload: ${formatValidationError(parsedRequest.error)}`);
    }

    const rawResponse = await ipcRenderer.invoke(IPC_CHANNELS.loadReviewSession, parsedRequest.data);
    const parsedResponse = LoadReviewSessionResponseSchema.safeParse(rawResponse);

    if (!parsedResponse.success) {
      throw new Error(
        `Invalid review session response payload: ${formatValidationError(parsedResponse.error)}`
      );
    }

    return parsedResponse.data;
  }
};

contextBridge.exposeInMainWorld("mergepilot", bridge);
