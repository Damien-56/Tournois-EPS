import type { TournamentStore } from "./domain/types";

export type LanRole = "standalone" | "master" | "client";
export interface LanInfo { address: string; port: number; joinUrl: string; }
export interface LanAction { id: string; type: "record-match"; payload: Record<string, unknown>; }

interface NativeLanPlugin {
  start(options: { port: number }): Promise<LanInfo>;
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

export async function startLanHost(port = 8765): Promise<LanInfo> {
  const plugin = native();
  if (!plugin) throw new Error("Le serveur local Android n'est pas encore chargé");
  return plugin.start({ port });
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
  if (native()) return native()!.sendAction({ url: url.replace(/\/$/, ""), action: body });
  const response = await fetch(`${url.replace(/\/$/, "")}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!response.ok) throw new Error(`Serveur local indisponible (${response.status})`);
}

export async function fetchLanState(url: string): Promise<TournamentStore> {
  const response = await fetch(`${url.replace(/\/$/, "")}/state`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Connexion locale impossible (${response.status})`);
  return response.json() as Promise<TournamentStore>;
}
