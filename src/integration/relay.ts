import type { Match, Student, Tournament, TournamentStore } from "../domain/types";
import {
  createAttendanceEnvelope,
  createIndividualResultEnvelope,
  createIndividualTournamentEnvelope,
  type EpsInteropEnvelope,
} from "./epsInterop";
import { isValidMatchResult } from "../domain/matches";

const APP_ID = "tournois-sport-individuel";
const DEFAULT_RELAY_URL = "http://127.0.0.1:8766";
const RELAY_URL_KEY = "eps-relay-url";
const OUTBOX_KEY = "tournois-sport-individuel-relay-outbox-v1";
const SENT_KEY = "tournois-sport-individuel-relay-sent-v1";
const ATTENDANCE_KEY = "tournois-sport-individuel-relay-attendance-v1";

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
      capabilities: ["individual-tournament", "individual-result", "attendance"],
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
