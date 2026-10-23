import type { TournamentStore } from "./domain/types";

/**
 * Contrat d'intégration volontairement sans dépendance réseau.
 * Les autres applications EPS peuvent écouter les événements et demander
 * un export JSON via window.epsTournois.
 */
export interface EpsTournoisBridge {
  getSnapshot: () => TournamentStore;
  importSnapshot: (snapshot: TournamentStore) => void;
  onChange: (listener: (snapshot: TournamentStore) => void) => () => void;
}

export function installIntegrationBridge(getSnapshot: () => TournamentStore, importSnapshot: (snapshot: TournamentStore) => void) {
  const listeners = new Set<(snapshot: TournamentStore) => void>();
  const bridge: EpsTournoisBridge = {
    getSnapshot,
    importSnapshot,
    onChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }
  };
  window.epsTournois = bridge;
  return (snapshot: TournamentStore) => listeners.forEach((listener) => listener(snapshot));
}

declare global {
  interface Window { epsTournois?: EpsTournoisBridge; }
}
