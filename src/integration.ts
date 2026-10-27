import type { TournamentStore } from "./domain/types";

export const EPS_TOURNOIS_BRIDGE_VERSION = 1 as const;
export const EPS_TOURNOIS_BRIDGE_CAPABILITIES = ["snapshot.read", "snapshot.import", "snapshot.subscribe"] as const;

/**
 * Contrat d'intégration volontairement sans dépendance réseau.
 * Les autres applications EPS peuvent écouter les événements et demander
 * un export JSON via window.epsTournois.
 */
export interface EpsTournoisBridge {
  version: typeof EPS_TOURNOIS_BRIDGE_VERSION;
  capabilities: typeof EPS_TOURNOIS_BRIDGE_CAPABILITIES;
  getSnapshot: () => TournamentStore;
  importSnapshot: (snapshot: TournamentStore) => void;
  onChange: (listener: (snapshot: TournamentStore) => void) => () => void;
}

export function installIntegrationBridge(getSnapshot: () => TournamentStore, importSnapshot: (snapshot: TournamentStore) => void) {
  const listeners = new Set<(snapshot: TournamentStore) => void>();
  const bridge: EpsTournoisBridge = {
    version: EPS_TOURNOIS_BRIDGE_VERSION,
    capabilities: EPS_TOURNOIS_BRIDGE_CAPABILITIES,
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
