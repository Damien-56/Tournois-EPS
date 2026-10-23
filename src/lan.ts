import type { TournamentStore } from "./domain/types";

export type LanRole = "standalone" | "master" | "client";
export interface LanInfo { address: string; port: number; joinUrl: string; }
export interface LanPeer { name: string; address: string; port: number; joinUrl: string; }
export interface LanAction { id: string; type: "record-match" | "delete-match"; payload: Record<string, unknown>; }

interface NativeLanPlugin {
  start(options: { port: number }): Promise<LanInfo>;
  discover(): Promise<{ peers: LanPeer[] }>;
  stop(): Promise<void>;
  setState(options: { state: string }): Promise<void>;
  getState(): Promise<{ state: string; revision: number }>;
  getActions(options: { after: number }): Promise<{ actions: Array<{ sequence: number; action: string }> }>;
  sendAction(options: { url: string; action: string }): Promise<void>;
}

declare global {
  interface Window { Capacitor?: { Plugins?: { LanSync?: NativeLanPlugin } }; }
}

const native = () => window.Capacitor?.Plugins?.LanSync;

export function hasNativeLanHost() { return Boolean(native()); }

export function lanEndpoint(baseUrl: string, path: "/state" | "/action") {
  const url = new URL(baseUrl, window.location.href);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
  return url.toString();
}

export async function startLanHost(port = 8765): Promise<LanInfo> {
  const plugin = native();
  if (!plugin) throw new Error("Le serveur local Android n'est pas encore chargé");
  return plugin.start({ port });
}

export async function discoverLanHosts(): Promise<LanPeer[]> {
  const result = await native()?.discover();
  return result?.peers ?? [];
}

export async function stopLanHost() { await native()?.stop(); }

export async function publishLanState(store: TournamentStore) {
  await native()?.setState({ state: JSON.stringify(store) });
}

export async function readLanState(): Promise<TournamentStore | undefined> {
  const result = await native()?.getState();
  if (!result?.state) return undefined;
  try { return JSON.parse(result.state) as TournamentStore; } catch { return undefined; }
}

export async function readLanActions(after: number) {
  const result = await native()?.getActions({ after });
  return result?.actions ?? [];
}

export async function sendLanAction(url: string, action: LanAction) {
  const body = JSON.stringify(action);
  const endpoint = lanEndpoint(url, "/action");
  if (native()) return native()!.sendAction({ url: endpoint, action: body });
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!response.ok) throw new Error(`Serveur local indisponible (${response.status})`);
}

export async function fetchLanState(url: string): Promise<TournamentStore> {
  const response = await fetch(lanEndpoint(url, "/state"), { cache: "no-store" });
  if (!response.ok) throw new Error(`Connexion locale impossible (${response.status})`);
  return response.json() as Promise<TournamentStore>;
}

const QUEUE_PREFIX = "tournois-eps.lan-actions.v1.";

function queueKey(url: string) {
  return `${QUEUE_PREFIX}${url}`;
}

/** Keeps client actions recoverable when Wi-Fi briefly disappears. Retries are safe because the master deduplicates ids. */
export function queueLanAction(url: string, action: LanAction) {
  const key = queueKey(url);
  const queued = readQueuedLanActions(url);
  if (!queued.some((item) => item.id === action.id)) {
    localStorage.setItem(key, JSON.stringify([...queued, action]));
  }
}

export function readQueuedLanActions(url: string): LanAction[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(queueKey(url)) || "[]") as LanAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function flushQueuedLanActions(url: string): Promise<number> {
  const queued = readQueuedLanActions(url);
  const remaining: LanAction[] = [];
  for (const action of queued) {
    try { await sendLanAction(url, action); } catch { remaining.push(action); }
  }
  const key = queueKey(url);
  if (remaining.length) localStorage.setItem(key, JSON.stringify(remaining));
  else localStorage.removeItem(key);
  return queued.length - remaining.length;
}
