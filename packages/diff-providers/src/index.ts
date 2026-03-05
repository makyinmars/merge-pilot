import type { ExternalReviewStatus, ReviewSessionExport } from "@mergepilot/shared-types";

export interface PreparedExportContract {
  payloadHash: string;
  payloadBytes: number;
  mode: "deep-link" | "manual";
  warnings: string[];
}

export interface OpenExternalReviewContract {
  url: string;
  mode: "deep-link" | "manual";
  note?: string;
}

export interface DiffProviderAdapter {
  prepareExport(session: ReviewSessionExport): PreparedExportContract;
  openExternalReview(preparedExport: PreparedExportContract): OpenExternalReviewContract;
  syncExternalStatus(sessionId: string): ExternalReviewStatus;
}

export * from "./diffs-com.js";
