import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SIDECAR_SUFFIX, type SavedCheck } from "@openlabel/check";
import type { DailyMed, Label } from "@openlabel/label";
import { blastRadius, type Impact } from "./blast.ts";
import { diffLabels, type LabelDiff } from "./diff.ts";

export type LibraryPiece = { file: string; saved: SavedCheck };

export type PieceImpact = { file: string; diff: LabelDiff; impacts: Impact[] };

export type WatchResult = { pieces: PieceImpact[]; current: LibraryPiece[] };

export async function loadLibrary(dir: string): Promise<LibraryPiece[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const sidecars = entries
    .filter((e) => e.isFile() && e.name.endsWith(SIDECAR_SUFFIX))
    .map((e) => join(e.parentPath, e.name))
    .sort();
  return Promise.all(
    sidecars.map(async (path) => ({
      file: path.slice(0, -SIDECAR_SUFFIX.length),
      saved: JSON.parse(await readFile(path, "utf8")) as SavedCheck,
    })),
  );
}

export async function watchLibrary(library: LibraryPiece[], dailyMed: DailyMed): Promise<WatchResult> {
  const labels = new Map<string, Promise<Label>>();
  const load = (setId: Label["setId"], version?: number) => {
    const key = `${setId}@${version ?? "current"}`;
    if (!labels.has(key)) labels.set(key, dailyMed.label(setId, version));
    return labels.get(key)!;
  };

  const pieces: PieceImpact[] = [];
  const current: LibraryPiece[] = [];
  for (const piece of library) {
    const { setId, version } = piece.saved.label;
    const latest = await load(setId);
    if (latest.version === version) {
      current.push(piece);
      continue;
    }
    const diff = diffLabels(await load(setId, version), latest);
    pieces.push({ file: piece.file, diff, impacts: blastRadius(piece.saved, diff) });
  }
  return { pieces, current };
}
