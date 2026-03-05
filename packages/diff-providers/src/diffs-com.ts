import {
  DiffProviderExportPayloadSchema,
  ExternalReviewStatusSchema,
  ReviewSessionExportSchema,
  type DiffProviderExportPayload,
  type ExternalReviewStatus,
  type ReviewSessionExport
} from "@mergepilot/shared-types";

function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }

  return Math.abs(hash >>> 0).toString(16);
}

export interface PreparedExport {
  payload: DiffProviderExportPayload;
  payloadHash: string;
  payloadBytes: number;
  mode: "deep-link" | "manual";
  deepLink?: string;
  warnings: string[];
}

export interface OpenExternalReviewResult {
  url: string;
  mode: "deep-link" | "manual";
  note?: string;
}

export interface DiffsComAdapterOptions {
  baseUrl?: string;
  maxDeepLinkPayloadBytes?: number;
}

export class DiffsComAdapter {
  private readonly baseUrl: string;
  private readonly maxDeepLinkPayloadBytes: number;

  public constructor(options: DiffsComAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://diffs.com";
    this.maxDeepLinkPayloadBytes = options.maxDeepLinkPayloadBytes ?? 8_000;
  }

  public prepareExport(sessionInput: ReviewSessionExport): PreparedExport {
    const session = ReviewSessionExportSchema.parse(sessionInput);

    const payload = DiffProviderExportPayloadSchema.parse({
      provider: "diffs.com",
      exportedAt: new Date().toISOString(),
      session,
      metadata: {
        source: "mergepilot",
        version: "0.1.0"
      }
    });

    const serialized = JSON.stringify(payload);
    const payloadHash = stableHash(serialized);
    const payloadBytes = Buffer.byteLength(serialized, "utf8");

    if (payloadBytes <= this.maxDeepLinkPayloadBytes) {
      const encoded = encodeURIComponent(serialized);
      return {
        payload,
        payloadHash,
        payloadBytes,
        mode: "deep-link",
        deepLink: `${this.baseUrl}/?source=mergepilot&import=${encoded}`,
        warnings: []
      };
    }

    return {
      payload,
      payloadHash,
      payloadBytes,
      mode: "manual",
      warnings: [
        "Payload exceeds deep-link size budget; use manual handoff until API upload is available."
      ]
    };
  }

  public openExternalReview(preparedExport: PreparedExport): OpenExternalReviewResult {
    if (preparedExport.mode === "deep-link" && preparedExport.deepLink) {
      return {
        url: preparedExport.deepLink,
        mode: "deep-link"
      };
    }

    return {
      url: `${this.baseUrl}/`,
      mode: "manual",
      note: "Open diffs.com and import the exported payload manually (Phase 1 baseline)."
    };
  }

  public syncExternalStatus(): ExternalReviewStatus {
    return ExternalReviewStatusSchema.parse({
      provider: "diffs.com",
      state: "not-supported",
      checkedAt: new Date().toISOString(),
      reason: "API-based status sync is deferred until provider API capabilities are confirmed."
    });
  }
}
