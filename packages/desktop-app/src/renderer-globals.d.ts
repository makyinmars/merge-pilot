import type { MergePilotBridge } from "./ipc-contracts.js";

declare global {
  interface Window {
    mergepilot: MergePilotBridge;
  }
}

export {};
