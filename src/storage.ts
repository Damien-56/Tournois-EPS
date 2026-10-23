import type { TournamentStore } from "./domain/types";

export const STORAGE_KEY = "tournois-eps.local.v1";

const emptyStore = (): TournamentStore => ({ version: 1, classes: [], tournaments: [] });

export function loadStore(): TournamentStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as TournamentStore;
    return parsed?.version === 1 && Array.isArray(parsed.classes) && Array.isArray(parsed.tournaments)
      ? parsed
      : emptyStore();
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: TournamentStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function exportStore(store: TournamentStore) {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tournois-eps-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importStore(file: File): Promise<TournamentStore> {
  const parsed = JSON.parse(await file.text()) as TournamentStore;
  if (parsed?.version !== 1 || !Array.isArray(parsed.classes) || !Array.isArray(parsed.tournaments)) {
    throw new Error("Format de sauvegarde Tournois EPS invalide");
  }
  return parsed;
}
