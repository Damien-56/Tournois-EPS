import type { Match, SchoolClass, Student, Tournament, TournamentStore } from "../domain/types";
import {
  createAttendanceEnvelope,
  createIndividualResultEnvelope,
  createIndividualTournamentEnvelope,
  createStudentClassRosterEnvelope,
  type AttendancePayload,
  type EpsInteropEnvelope,
  type StudentClassRosterPayload,
} from "./epsInterop";
import { isValidMatchResult } from "../domain/matches";

const APP_ID = "tournois-sport-individuel";
const DEFAULT_RELAY_URL = "http://127.0.0.1:8766";
const RELAY_URL_KEY = "eps-relay-url";
const OUTBOX_KEY = "tournois-sport-individuel-relay-outbox-v1";
const SENT_KEY = "tournois-sport-individuel-relay-sent-v1";
const ATTENDANCE_KEY = "tournois-sport-individuel-relay-attendance-v1";
const ROSTER_CURSOR_KEY = "tournois-sport-individuel-relay-roster-cursor-v1";
const ROSTER_SNAPSHOT_KEY = "tournois-sport-individuel-relay-roster-snapshot-v1";
const ROSTER_TOMBSTONES_KEY = "tournois-sport-individuel-relay-roster-tombstones-v1";
const ATTENDANCE_INBOX_KEY = "tournois-sport-individuel-relay-attendance-inbox-v1";

type RelayEnvelope = EpsInteropEnvelope;
type QueuedEnvelope = { envelope: RelayEnvelope; queuedAt: string };
type SentEntry = { revision: number; fingerprint: string };
type AttendanceState = { status: Student["status"]; revision: number; changedAt: string };

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function writeJson(key: string, value: unknown): void { storage()?.setItem(key, JSON.stringify(value)); }
function relayUrl(): string { return storage()?.getItem(RELAY_URL_KEY) ?? DEFAULT_RELAY_URL; }
function fingerprint(value: unknown): string { return JSON.stringify(value); }
function entityKey(envelope: RelayEnvelope): string { return `${envelope.resource}:${envelope.entityId}`; }

function nextRevision(envelope: RelayEnvelope): RelayEnvelope | null {
  const sent = readJson<Record<string, SentEntry>>(SENT_KEY, {});
  const previous = sent[entityKey(envelope)];
  const currentFingerprint = fingerprint(envelope.payload);
  if (previous?.fingerprint === currentFingerprint) return null;
  return { ...envelope, revision: previous ? previous.revision + 1 : 1 };
}

function markSent(envelope: RelayEnvelope): void {
  const sent = readJson<Record<string, SentEntry>>(SENT_KEY, {});
  sent[entityKey(envelope)] = { revision: envelope.revision, fingerprint: fingerprint(envelope.payload) };
  writeJson(SENT_KEY, sent);
}

function enqueue(envelope: RelayEnvelope): void {
  const queue = readJson<QueuedEnvelope[]>(OUTBOX_KEY, []);
  if (!queue.some((entry) => entry.envelope.eventId === envelope.eventId && entry.envelope.revision === envelope.revision)) {
    queue.push({ envelope, queuedAt: new Date().toISOString() });
    writeJson(OUTBOX_KEY, queue);
  }
}

async function request(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(`${relayUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Relais EPS HTTP ${response.status}`);
}

async function register(): Promise<void> {
  await request("/register", {
    method: "POST",
    body: JSON.stringify({
      appId: APP_ID,
      version: "0.1.0",
      capabilities: ["student-class-roster", "individual-tournament", "individual-result", "attendance"],
      registeredAt: new Date().toISOString(),
    }),
  });
}

async function publish(envelope: RelayEnvelope): Promise<void> {
  const next = nextRevision(envelope);
  if (!next) return;
  try {
    await register();
    await request("/events", { method: "POST", body: JSON.stringify(next) });
    markSent(next);
  } catch { enqueue(next); }
}

async function flushOutbox(): Promise<void> {
  const queue = readJson<QueuedEnvelope[]>(OUTBOX_KEY, []);
  if (!queue.length) return;
  await register();
  const remaining: QueuedEnvelope[] = [];
  for (const entry of queue) {
    try {
      await request("/events", { method: "POST", body: JSON.stringify(entry.envelope) });
      markSent(entry.envelope);
    } catch { remaining.push(entry); }
  }
  writeJson(OUTBOX_KEY, remaining);
}

function studentPayload(student: Student, classId: string): Record<string, unknown> {
  return { studentId: student.id, name: student.name, classId, status: student.status };
}

function splitStudentName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() ?? name.trim(), lastName: parts.join(" ") };
}

function studentClassRosterPayload(store: TournamentStore): StudentClassRosterPayload {
  type RosterClass = StudentClassRosterPayload["classes"][number];
  type RosterStudent = StudentClassRosterPayload["students"][number];
  const previous = readJson<{ classes: RosterClass[]; students: RosterStudent[] }>(ROSTER_SNAPSHOT_KEY, { classes: [], students: [] });
  const tombstones = readJson<{ classes: RosterClass[]; students: RosterStudent[] }>(ROSTER_TOMBSTONES_KEY, { classes: [], students: [] });
  const classes = store.classes.map((schoolClass): RosterClass => ({
    classId: schoolClass.id,
    name: schoolClass.name,
    active: schoolClass.active !== false,
  }));
  const students = store.classes.flatMap((schoolClass): RosterStudent[] => schoolClass.students.map((student) => ({
    studentId: student.id,
    ...splitStudentName(student.name),
    classId: schoolClass.id,
    status: student.status,
    active: student.active !== false && schoolClass.active !== false,
  })));
  const currentClassIds = new Set(classes.map((item) => item.classId));
  const currentStudentIds = new Set(students.map((item) => item.studentId));
  const deletedAt = new Date().toISOString();
  for (const item of previous.classes) if (!currentClassIds.has(item.classId) && !tombstones.classes.some((value) => value.classId === item.classId)) tombstones.classes.push({ ...item, active: false, deletedAt });
  for (const item of previous.students) if (!currentStudentIds.has(item.studentId) && !tombstones.students.some((value) => value.studentId === item.studentId)) tombstones.students.push({ ...item, active: false, deletedAt });
  tombstones.classes = tombstones.classes.filter((item) => !currentClassIds.has(item.classId));
  tombstones.students = tombstones.students.filter((item) => !currentStudentIds.has(item.studentId));
  writeJson(ROSTER_SNAPSHOT_KEY, { classes, students });
  writeJson(ROSTER_TOMBSTONES_KEY, tombstones);
  return {
    rosterId: `tournois-sport-individuel:${store.version}`,
    classes: [...classes, ...tombstones.classes],
    students: [...students, ...tombstones.students],
  };
}

function studentClassRosterEnvelope(store: TournamentStore): EpsInteropEnvelope<StudentClassRosterPayload> {
  const payload = studentClassRosterPayload(store);
  return createStudentClassRosterEnvelope({ eventId: payload.rosterId, entityId: payload.rosterId, payload });
}

function tournamentPayload(store: TournamentStore, tournament: Tournament): Record<string, unknown> | null {
  const schoolClass = store.classes.find((item) => item.id === tournament.classId);
  if (!schoolClass || !schoolClass.students.length) return null;
  const players = schoolClass.students.map((student) => studentPayload(student, schoolClass.id));
  return {
    eventId: tournament.id,
    activityId: tournament.sport ?? "sport-individuel",
    title: tournament.name,
    name: tournament.name,
    classId: schoolClass.id,
    className: schoolClass.name,
    date: tournament.createdAt,
    mode: tournament.mode,
    players,
    matches: tournament.matches.map((match) => isValidMatchResult(match)
      ? match
      : { ...match, scoreA: undefined, scoreB: undefined }),
    standings: schoolClass.students.map((student) => ({
      studentId: student.id,
      name: student.name,
      points: student.points,
      matches: student.matches,
      wins: student.wins,
      losses: student.losses,
      rank: 0,
    })),
  };
}

function attendanceState(classId: string, student: Student, sessionId: string): { revision: number; changedAt: string } {
  const key = `${classId}:${student.id}:${sessionId}`;
  const states = readJson<Record<string, AttendanceState>>(ATTENDANCE_KEY, {});
  const previous = states[key];
  if (previous?.status === student.status) return previous;
  const next = { status: student.status, revision: (previous?.revision ?? 0) + 1, changedAt: new Date().toISOString() };
  states[key] = next;
  writeJson(ATTENDANCE_KEY, states);
  return next;
}

export async function publishIndividualStore(store: TournamentStore): Promise<void> {
  await flushOutbox().catch(() => undefined);
  if (store.classes.length) await publish(studentClassRosterEnvelope(store));
  for (const tournament of store.tournaments) {
    const payload = tournamentPayload(store, tournament);
    if (!payload) continue;
    await publish(createIndividualTournamentEnvelope({
      eventId: tournament.id,
      entityId: tournament.id,
      payload: payload as never,
    }));

    const schoolClass = store.classes.find((item) => item.id === tournament.classId);
    if (!schoolClass) continue;
    for (const match of tournament.matches) {
      if (!isValidMatchResult(match)) continue;
      for (const [studentId, score] of [[match.playerAId, match.scoreA], [match.playerBId, match.scoreB]] as const) {
        const student = schoolClass.students.find((item) => item.id === studentId);
        if (!student || !Number.isFinite(score)) continue;
        await publish(createIndividualResultEnvelope({
          eventId: tournament.id,
          entityId: `${match.id}:${student.id}`,
          payload: {
            resultId: `${match.id}:${student.id}`,
            eventId: tournament.id,
            studentId: student.id,
            studentName: student.name,
            classId: schoolClass.id,
            score,
            matchId: match.id,
            playedAt: match.playedAt,
            opponentStudentId: student.id === match.playerAId ? match.playerBId : match.playerAId,
          },
        }));
      }
    }
    for (const student of schoolClass.students) {
      const attendance = attendanceState(schoolClass.id, student, tournament.id);
      await publish(createAttendanceEnvelope({
        eventId: `${tournament.id}:attendance:${student.id}`,
        entityId: `attendance:${tournament.id}:${schoolClass.id}:${student.id}`,
        revision: attendance.revision,
        payload: {
          studentId: student.id,
          classId: schoolClass.id,
          sessionId: tournament.id,
          status: student.status,
          changedAt: attendance.changedAt,
        },
      }));
    }
  }
}

function rosterCursor(): number {
  const value = Number(storage()?.getItem(ROSTER_CURSOR_KEY) ?? "0");
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function relayJson(path: string): Promise<{ records?: Array<{ sequence: number; envelope?: RelayEnvelope }>; nextCursor?: number }> {
  const response = await fetch(`${relayUrl()}${path}`, { headers: { "content-type": "application/json" } });
  if (!response.ok) throw new Error(`Relais EPS HTTP ${response.status}`);
  return response.json() as Promise<{ records?: Array<{ sequence: number; envelope?: RelayEnvelope }>; nextCursor?: number }>;
}

export function mergeStudentClassRoster(store: TournamentStore, payload: StudentClassRosterPayload, sourceApp: string): TournamentStore {
  const classes = store.classes.map((schoolClass) => ({ ...schoolClass, students: schoolClass.students.map((student) => ({ ...student })) }));
  const source = sourceApp || "unknown-source";
  const classByExternalId = new Map<string, SchoolClass>();
  for (const item of classes) {
    if (item.sourceApp === source && item.externalId) classByExternalId.set(item.externalId, item);
  }
  for (const item of payload.classes) {
    const existing = classByExternalId.get(item.classId);
    if (item.active === false) {
      if (existing) existing.active = false;
      continue;
    }
    if (existing) {
      existing.name = item.name;
      existing.active = true;
      continue;
    }
    const created: SchoolClass = { id: `interop-${source}-${item.classId}`, externalId: item.classId, sourceApp: source, name: item.name, createdAt: new Date().toISOString(), students: [], active: true };
    classes.push(created);
    classByExternalId.set(item.classId, created);
  }
  const classByStudent = new Map<string, SchoolClass>();
  for (const schoolClass of classes) for (const student of schoolClass.students) if (student.sourceApp === source && student.externalId) classByStudent.set(student.externalId, schoolClass);
  for (const item of payload.students) {
    const targetClass = item.classId ? classByExternalId.get(item.classId) : undefined;
    if (!targetClass) continue;
    const previousClass = classByStudent.get(item.studentId);
    const existing = [...classes].flatMap((schoolClass) => schoolClass.students).find((student) => student.sourceApp === source && student.externalId === item.studentId);
    if (item.active === false) {
      if (existing) existing.active = false;
      continue;
    }
    const name = `${item.firstName} ${item.lastName}`.trim();
    if (existing) {
      existing.name = name;
      existing.active = true;
      if (item.status) existing.status = item.status;
      if (previousClass && previousClass.id !== targetClass.id) previousClass.students = previousClass.students.filter((student) => student.id !== existing.id);
      if (!targetClass.students.some((student) => student.id === existing.id)) targetClass.students.push(existing);
      continue;
    }
    targetClass.students.push({ id: `interop-${source}-${item.studentId}`, externalId: item.studentId, sourceApp: source, name, level: 3, status: item.status ?? "present", points: 0, matches: 0, wins: 0, losses: 0, refereed: 0, active: true });
    classByStudent.set(item.studentId, targetClass);
  }
  return { ...store, classes };
}

export function mergeIncomingAttendance(store: TournamentStore, payload: AttendancePayload, sourceApp: string): TournamentStore {
  const student = store.classes
    .flatMap((schoolClass) => schoolClass.students)
    .find((candidate) => candidate.sourceApp === sourceApp && candidate.externalId === payload.studentId);
  const incomingStatus = String(payload.status);
  const status = incomingStatus === "present"
    ? "present"
    : incomingStatus === "absent"
      ? "absent"
      : incomingStatus === "dispensed" || incomingStatus === "non-pratiquant" || incomingStatus === "inapte"
        ? "non-pratiquant"
        : null;
  if (!student || !status) {
    const inbox = readJson<Array<{ sourceApp: string; payload: AttendancePayload }>>(ATTENDANCE_INBOX_KEY, []);
    if (!inbox.some((entry) => entry.sourceApp === sourceApp && entry.payload.sessionId === payload.sessionId && entry.payload.studentId === payload.studentId && entry.payload.revision === payload.revision)) {
      inbox.push({ sourceApp, payload });
      writeJson(ATTENDANCE_INBOX_KEY, inbox.slice(-250));
    }
    return store;
  }
  return {
    ...store,
    classes: store.classes.map((schoolClass) => ({
      ...schoolClass,
      students: schoolClass.students.map((candidate) => candidate.id === student.id ? { ...candidate, status } : candidate),
    })),
  };
}

export function startIndividualRosterRelay(
  onRoster: (payload: StudentClassRosterPayload, sourceApp: string) => void,
  onAttendance?: (payload: AttendancePayload, sourceApp: string) => void,
): () => void {
  let cancelled = false;
  const pull = async () => {
    try {
      await register();
      const cursor = rosterCursor();
      const result = await relayJson(`/events?appId=${encodeURIComponent(APP_ID)}&after=${cursor}`);
      for (const record of result.records ?? []) {
        const envelope = record.envelope;
        if (envelope?.resource === "student-class-roster" && envelope.sourceApp !== APP_ID) onRoster(envelope.payload as StudentClassRosterPayload, envelope.sourceApp);
        if (envelope?.resource === "attendance" && envelope.sourceApp !== APP_ID) onAttendance?.(envelope.payload as AttendancePayload, envelope.sourceApp);
        storage()?.setItem(ROSTER_CURSOR_KEY, String(record.sequence));
      }
      if (typeof result.nextCursor === "number" && result.nextCursor > cursor) storage()?.setItem(ROSTER_CURSOR_KEY, String(result.nextCursor));
    } catch { /* The relay is optional and retried on the next cycle. */ }
  };
  void pull();
  const timer = window.setInterval(() => void pull(), 5000);
  return () => window.clearInterval(timer);
}
