import type { Report } from "./types.ts";

// A check report saved next to the piece it describes, so Watch can tell which
// label sentences each approved claim rests on.
export type SavedCheck = Report & { checkedAt: string };

export const SIDECAR_SUFFIX = ".check.json";

export function sidecarPath(pieceFile: string): string {
  return `${pieceFile}${SIDECAR_SUFFIX}`;
}
