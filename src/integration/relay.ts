import type { TournamentStore } from "../domain/types";

const APP_ID = "tournois-sport-individuel";
const DEFAULT_RELAY_URL = "http://127.0.0.1:8766";
const RELAY_URL_KEY = "eps-relay-url";
const OUTBOX_KEY = "tournois-sport-individuel-relay-outbox-v1";
const SENT_KEY = "tournois-sport-individuel-relay-sent-v1";
const CURSOR_KEY = "tournois-sport-individuel-relay-cursor-v1";
const INBOX_KEY = "tournois-sport-individuel-relay-inbox-v1";

type RelayEnvelope = {
  schema: "eps.interop-envelope";
  version: 1;
  type: "event";
  source: { app: string; version: string };
  sourceApp: string;
  target?: { app: string };
  resource: string;
  action: "upsert" | "delete";
  eventId: string;
  entityId: string;
  revision: number;
  schemaVersion: "2.0";
  createdAt: string;
  payload: unknown;
};
type QueueEntry = { envelope: RelayEnvelope; queuedAt: string };
type SentEntry = { revision: number; fingerprint: string };

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
function readJson<T>(key: string, fallback: T): T {
  try { const raw = storage()?.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void { try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* offline */ } }
function relayUrl(): string { return storage()?.getItem(RELAY_URL_KEY) ?? DEFAULT_RELAY_URL; }
function fingerprint(value: unknown): string { return JSON.stringify(value); }
function entityKey(envelope: RelayEnvelope): string { return `${envelope.resource}:${envelope.entityId}`; }
function revisioned(envelope: RelayEnvelope): RelayEnvelope {
  const sent = readJson<Record<string, SentEntry>>(SENT_KEY, {});
  const previous = sent[entityKey(envelope)];
  const revision = previous?.fingerprint === fingerprint(envelope.payload) ? previous.revision : (previous?.revision ?? 0) + 1;
  return { ...envelope, revision };
}
function baseEnvelope(resource: string, entityId: string, payload: unknown, target?: string): RelayEnvelope {
  const now = new Date().toISOString();
  return {
    schema: "eps.interop-envelope", version: 1, type: "event",
    source: { app: APP_ID, version: "1.0.0" }, sourceApp: APP_ID,
    ...(target ? { target: { app: target } } : {}), resource, action: "upsert",
    eventId: entityId, entityId, revision: 1, schemaVersion: "2.0", createdAt: now, payload,
  };
}
function rosterEnvelope(store: TournamentStore): RelayEnvelope {
  return baseEnvelope("student-class-roster", `student-class-roster:${APP_ID}`, {
    rosterId: `student-class-roster:${APP_ID}`,
    classes: store.classes.map((schoolClass) => ({
      classId: schoolClass.externalId ?? schoolClass.id,
      name: schoolClass.name,
      active: true,
      studentIds: schoolClass.students.map((student) => student.externalId ?? student.id),
    })),
    students: store.classes.flatMap((schoolClass) => schoolClass.students.map((student) => ({
      studentId: student.externalId ?? student.id,
      firstName: student.name.split(/\s+/u)[0] ?? student.name,
      lastName: student.name.split(/\s+/u).slice(1).join(" ") || student.name,
      classId: schoolClass.externalId ?? schoolClass.id,
      active: true,
    }))),
  });
}
function attendanceEnvelopes(store: TournamentStore): RelayEnvelope[] {
  return store.classes.flatMap((schoolClass) => schoolClass.students.map((student) => {
    const entityId = `attendance:${schoolClass.externalId ?? schoolClass.id}:${student.externalId ?? student.id}`;
    return baseEnvelope("attendance", entityId, {
      studentId: student.externalId ?? student.id,
      classId: schoolClass.externalId ?? schoolClass.id,
      sessionId: `tournois-individuel:${schoolClass.externalId ?? schoolClass.id}`,
      status: student.status === "non-pratiquant" ? "inapt" : student.status,
      ...(student.status === "non-pratiquant" ? { sourceStatus: student.status } : {}),
      changedAt: new Date().toISOString(),
    }, "tableau-de-bord-eps");
  }));
}
function tournamentEnvelopes(store: TournamentStore): RelayEnvelope[] {
  return store.tournaments.map((tournament) => {
    const schoolClass = store.classes.find((item) => item.id === tournament.classId);
    const students = schoolClass?.students ?? [];
    const payload = {
      eventId: tournament.id, activityId: tournament.sport ?? "sport-individuel", name: tournament.name,
      date: tournament.createdAt, classId: schoolClass?.externalId ?? schoolClass?.id,
      students: students.map((student) => ({ studentId: student.externalId ?? student.id, name: student.name })),
      matches: tournament.matches.map((match) => ({ resultId: match.id, studentIds: [match.playerAId, match.playerBId], score: { a: match.scoreA, b: match.scoreB }, playedAt: match.playedAt })),
    };
    return baseEnvelope("individual-tournament", `individual-tournament:${tournament.id}`, payload, "tableau-de-bord-eps");
  });
}
async function request(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(`${relayUrl()}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`Relais EPS HTTP ${response.status}`);
}
async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${relayUrl()}${path}`, { headers: { "content-type": "application/json" } });
  if (!response.ok) throw new Error(`Relais EPS HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
async function register(): Promise<void> {
  await request("/register", { method: "POST", body: JSON.stringify({ appId: APP_ID, version: "1.0.0", capabilities: ["student-class-roster", "attendance", "individual-tournament", "individual-result"], registeredAt: new Date().toISOString() }) });
}
function enqueue(envelope: RelayEnvelope): void {
  const queue = readJson<QueueEntry[]>(OUTBOX_KEY, []);
  if (!queue.some((entry) => entry.envelope.eventId === envelope.eventId && entry.envelope.revision === envelope.revision)) queue.push({ envelope, queuedAt: new Date().toISOString() });
  writeJson(OUTBOX_KEY, queue);
}
function markSent(envelope: RelayEnvelope): void {
  const sent = readJson<Record<string, SentEntry>>(SENT_KEY, {});
  sent[entityKey(envelope)] = { revision: envelope.revision, fingerprint: fingerprint(envelope.payload) };
  writeJson(SENT_KEY, sent);
}
async function send(envelope: RelayEnvelope): Promise<void> { await request("/events", { method: "POST", body: JSON.stringify(envelope) }); markSent(envelope); }
async function flush(): Promise<void> {
  const queue = readJson<QueueEntry[]>(OUTBOX_KEY, []); if (!queue.length) return; await register(); const remaining: QueueEntry[] = [];
  for (const entry of queue) { try { await send(entry.envelope); } catch { remaining.push(entry); } } writeJson(OUTBOX_KEY, remaining);
}
export async function publishIndividualStore(store: TournamentStore): Promise<void> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  const envelopes = [rosterEnvelope(store), ...attendanceEnvelopes(store), ...tournamentEnvelopes(store)].map(revisioned);
  const sent = readJson<Record<string, SentEntry>>(SENT_KEY, {});
  const pending = envelopes.filter((envelope) => sent[entityKey(envelope)]?.fingerprint !== fingerprint(envelope.payload));
  if (!pending.length) return;
  try { await flush(); await register(); for (const envelope of pending) await send(envelope); } catch { pending.forEach(enqueue); }
}
export function startIndividualRelay(onEnvelope?: (envelope: RelayEnvelope) => void): () => void {
  let stopped = false; let timer: number | undefined;
  const pull = async () => {
    try {
      await register(); const cursor = Number(storage()?.getItem(CURSOR_KEY) ?? "0") || 0;
      const response = await requestJson<{ records?: Array<{ sequence: number; envelope: RelayEnvelope }>; nextCursor?: number }>(`/events?appId=${encodeURIComponent(APP_ID)}&after=${cursor}`);
      const inbox = readJson<RelayEnvelope[]>(INBOX_KEY, []);
      for (const record of response.records ?? []) { if (record.envelope.sourceApp !== APP_ID) { inbox.push(record.envelope); onEnvelope?.(record.envelope); } storage()?.setItem(CURSOR_KEY, String(record.sequence)); }
      writeJson(INBOX_KEY, inbox.slice(-200)); if ((response.nextCursor ?? cursor) > cursor) storage()?.setItem(CURSOR_KEY, String(response.nextCursor));
    } catch { /* retry */ }
  };
  const schedule = () => { if (!stopped) timer = window.setTimeout(() => void pull().finally(schedule), 10_000); };
  void pull().finally(schedule); return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
}
