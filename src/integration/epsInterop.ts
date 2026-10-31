import { uid } from "../domain/ids";
import type { SchoolClass, Student } from "../domain/types";

export const EPS_INTEROP_SCHEMA = "eps.interop-envelope" as const;
export const EPS_INTEROP_VERSION = 1 as const;
export const EPS_INTEROP_SCHEMA_VERSION = "2.0" as const;
export const CANONICAL_APPLICATION_ID = "tournois-sport-individuel" as const;
export const LEGACY_APPLICATION_ID = "tournois-eps" as const;
export const DEFAULT_SOURCE_VERSION = "0.1.0" as const;
export const DEFAULT_TARGET_APPLICATION_ID = "tableau-de-bord-eps" as const;

export type CanonicalEpsApplicationId =
  | typeof CANONICAL_APPLICATION_ID
  | "intervalle-eps"
  | "crossscan"
  | "course-orientation"
  | "gestion-sns"
  | "tableau-de-bord-eps"
  | "tournois-sport-collectif"
  | "acrosport-eps"
  | (string & {});

/** L’ancien identifiant est accepté par le lecteur, jamais utilisé par les créateurs. */
export type EpsApplicationId = CanonicalEpsApplicationId | typeof LEGACY_APPLICATION_ID;

export type CanonicalEpsInteropResource = "individual-tournament" | "individual-result" | "attendance";
export type LegacyEpsInteropResource = "interval-session" | "cross-event" | "orientation-course" | "sns-roster" | "eps-context";
export type EpsInteropResource = CanonicalEpsInteropResource | LegacyEpsInteropResource;
export type CanonicalEpsInteropAction = "upsert" | "export";
export type LegacyEpsInteropAction = "get" | "import" | "open";
export type EpsInteropAction = CanonicalEpsInteropAction | LegacyEpsInteropAction;
export type EpsInteropEnvelopeType = "event" | "request" | "data" | "response";

export interface EpsInteropSource {
  app: CanonicalEpsApplicationId;
  version: string;
}

export interface EpsInteropTarget {
  app: CanonicalEpsApplicationId;
}

/** Forme normalisée. Les créateurs n’émettent que ces propriétés. */
export interface EpsInteropEnvelope<T = unknown> {
  schema: typeof EPS_INTEROP_SCHEMA;
  version: typeof EPS_INTEROP_VERSION;
  eventId: string;
  type: "event";
  source: EpsInteropSource;
  sourceApp: CanonicalEpsApplicationId;
  target: EpsInteropTarget;
  resource: EpsInteropResource;
  action: EpsInteropAction;
  entityId: string;
  revision: number;
  schemaVersion: typeof EPS_INTEROP_SCHEMA_VERSION;
  createdAt: string;
  payload: T;
}

export interface EpsRosterStudent {
  studentId?: string;
  name: string;
  gender?: Student["gender"];
  level?: number;
  status?: Student["status"];
}

export interface EpsRosterPayload {
  classId?: string;
  groupId?: string;
  className?: string;
  students: EpsRosterStudent[];
}

export interface IndividualTournamentPayload {
  eventId: string;
  activityId: string;
  players: unknown[];
  matches: unknown[];
  [key: string]: unknown;
}

export interface IndividualResultPayload {
  resultId: string;
  eventId: string;
  studentId: string;
  score: number;
  [key: string]: unknown;
}

export interface AttendancePayload {
  studentId: string;
  classId: string;
  sessionId: string;
  status: Student["status"];
  changedAt: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function stableHash(value: unknown): string {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function canonicalizeApplicationId(value: string): CanonicalEpsApplicationId {
  return value === LEGACY_APPLICATION_ID ? CANONICAL_APPLICATION_ID : value;
}

function entityIdFromPayload(resource: EpsInteropResource, payload: unknown): string {
  if (isRecord(payload)) {
    if (nonEmptyString(payload.entityId)) return payload.entityId;
    if (resource === "attendance" && nonEmptyString(payload.sessionId) && nonEmptyString(payload.studentId)) return `${payload.sessionId}:${payload.studentId}`;
    for (const key of ["resultId", "eventId", "sessionId", "activityId", "classId", "groupId", "studentId"]) {
      if (nonEmptyString(payload[key])) return payload[key];
    }
  }
  return `${resource}-${stableHash(payload)}`;
}

function assertRevision(revision: number): number {
  if (!Number.isInteger(revision) || revision < 1) throw new Error("La révision d’un échange doit être un entier positif.");
  return revision;
}

type SourceOption = CanonicalEpsApplicationId | { app: EpsApplicationId; version?: string };
type TargetOption = CanonicalEpsApplicationId | { app: EpsApplicationId };

export interface CreateInteropEnvelopeOptions<T> {
  source?: SourceOption;
  target?: TargetOption;
  resource: CanonicalEpsInteropResource;
  action?: CanonicalEpsInteropAction;
  entityId?: string;
  revision?: number;
  schemaVersion?: typeof EPS_INTEROP_SCHEMA_VERSION;
  eventId?: string;
  createdAt?: string;
  payload: T;
}

function normalizeSource(source: SourceOption | undefined): EpsInteropSource {
  const app = typeof source === "string" ? source : source?.app ?? CANONICAL_APPLICATION_ID;
  return { app: canonicalizeApplicationId(app), version: typeof source === "string" ? DEFAULT_SOURCE_VERSION : source?.version ?? DEFAULT_SOURCE_VERSION };
}

function normalizeTarget(target: TargetOption | undefined): EpsInteropTarget {
  const app = typeof target === "string" ? target : target?.app ?? DEFAULT_TARGET_APPLICATION_ID;
  return { app: canonicalizeApplicationId(app) };
}

function createInteropEnvelope<T>(options: CreateInteropEnvelopeOptions<T>): EpsInteropEnvelope<T> {
  const revision = assertRevision(options.revision ?? 1);
  const schemaVersion = options.schemaVersion ?? EPS_INTEROP_SCHEMA_VERSION;
  if (schemaVersion !== EPS_INTEROP_SCHEMA_VERSION) throw new Error("Version de schéma d’échange inconnue.");
  const source = normalizeSource(options.source);
  const target = normalizeTarget(options.target);
  return {
    schema: EPS_INTEROP_SCHEMA,
    version: EPS_INTEROP_VERSION,
    eventId: options.eventId ?? uid("interop-event"),
    type: "event",
    source,
    sourceApp: source.app,
    target,
    resource: options.resource,
    action: options.action ?? "upsert",
    entityId: options.entityId?.trim() || entityIdFromPayload(options.resource, options.payload),
    revision,
    schemaVersion,
    createdAt: options.createdAt ?? new Date().toISOString(),
    payload: options.payload
  };
}

type ResourceEnvelopeOptions<T> = Omit<CreateInteropEnvelopeOptions<T>, "resource" | "payload"> & { payload: T };

function requireTournamentPayload(payload: unknown): IndividualTournamentPayload {
  if (!isRecord(payload) || !nonEmptyString(payload.eventId) || !nonEmptyString(payload.activityId) || !Array.isArray(payload.players) || !Array.isArray(payload.matches)) {
    throw new Error("Le payload individual-tournament doit contenir eventId, activityId, players et matches.");
  }
  return payload as IndividualTournamentPayload;
}

function requireResultPayload(payload: unknown): IndividualResultPayload {
  if (!isRecord(payload) || !nonEmptyString(payload.resultId) || !nonEmptyString(payload.eventId) || !nonEmptyString(payload.studentId) || typeof payload.score !== "number" || !Number.isFinite(payload.score)) {
    throw new Error("Le payload individual-result doit contenir resultId, eventId, studentId et score.");
  }
  return payload as IndividualResultPayload;
}

function requireAttendancePayload(payload: unknown): AttendancePayload {
  if (!isRecord(payload) || !nonEmptyString(payload.studentId) || !nonEmptyString(payload.classId) || !nonEmptyString(payload.sessionId) || (payload.status !== "present" && payload.status !== "absent" && payload.status !== "non-pratiquant") || !nonEmptyString(payload.changedAt)) {
    throw new Error("Le payload attendance doit contenir studentId, classId, sessionId, status et changedAt.");
  }
  return payload as AttendancePayload;
}

export function createIndividualTournamentEnvelope(options: ResourceEnvelopeOptions<IndividualTournamentPayload>): EpsInteropEnvelope<IndividualTournamentPayload> {
  const payload = requireTournamentPayload(options.payload);
  return createInteropEnvelope({ ...options, resource: "individual-tournament", eventId: options.eventId ?? payload.eventId, entityId: options.entityId ?? payload.eventId, payload });
}

export function createIndividualResultEnvelope(options: ResourceEnvelopeOptions<IndividualResultPayload>): EpsInteropEnvelope<IndividualResultPayload> {
  const payload = requireResultPayload(options.payload);
  return createInteropEnvelope({ ...options, resource: "individual-result", eventId: options.eventId ?? payload.eventId, entityId: options.entityId ?? payload.resultId, payload });
}

export function createAttendanceEnvelope(options: ResourceEnvelopeOptions<AttendancePayload>): EpsInteropEnvelope<AttendancePayload> {
  const payload = requireAttendancePayload(options.payload);
  return createInteropEnvelope({ ...options, resource: "attendance", entityId: options.entityId ?? `${payload.sessionId}:${payload.studentId}`, payload });
}

function readableResource(value: unknown): value is EpsInteropResource {
  return value === "individual-tournament" || value === "individual-result" || value === "attendance" || value === "interval-session" || value === "cross-event" || value === "orientation-course" || value === "sns-roster" || value === "eps-context";
}

function readableAction(value: unknown): value is EpsInteropAction {
  return value === "upsert" || value === "export" || value === "get" || value === "import" || value === "open";
}

function readableType(value: unknown): boolean {
  return value === "event" || value === "request" || value === "data" || value === "response";
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeSchemaVersion(value: unknown): typeof EPS_INTEROP_SCHEMA_VERSION | null {
  if (value === undefined || value === 1 || value === "1" || value === EPS_INTEROP_SCHEMA_VERSION) return EPS_INTEROP_SCHEMA_VERSION;
  return null;
}

export function parseInteropEnvelope(value: unknown): EpsInteropEnvelope | null {
  if (!isRecord(value) || value.schema !== EPS_INTEROP_SCHEMA || value.version !== EPS_INTEROP_VERSION) return null;
  const legacySource = isRecord(value.source) ? value.source : undefined;
  const rawSourceApp = value.sourceApp ?? legacySource?.app;
  const legacyTarget = isRecord(value.target) ? value.target : undefined;
  const rawTargetApp = legacyTarget?.app ?? value.targetApp;
  const eventId = value.eventId ?? value.id;
  if (!nonEmptyString(eventId) || !readableType(value.type) || !nonEmptyString(rawSourceApp) || !readableResource(value.resource) || !readableAction(value.action) || !nonEmptyString(value.createdAt) || !("payload" in value)) return null;
  const schemaVersion = normalizeSchemaVersion(value.schemaVersion);
  if (!schemaVersion) return null;
  if (value.resource === "individual-tournament") {
    try { requireTournamentPayload(value.payload); } catch { return null; }
  }
  if (value.resource === "individual-result") {
    try { requireResultPayload(value.payload); } catch { return null; }
  }
  if (value.resource === "attendance") {
    try { requireAttendancePayload(value.payload); } catch { return null; }
  }
  const source: EpsInteropSource = { app: canonicalizeApplicationId(rawSourceApp), version: nonEmptyString(legacySource?.version) ? legacySource.version : "legacy" };
  const target: EpsInteropTarget = { app: canonicalizeApplicationId(nonEmptyString(rawTargetApp) ? rawTargetApp : DEFAULT_TARGET_APPLICATION_ID) };
  return {
    schema: EPS_INTEROP_SCHEMA,
    version: EPS_INTEROP_VERSION,
    eventId,
    type: "event",
    source,
    sourceApp: source.app,
    target,
    resource: value.resource,
    action: value.action,
    entityId: nonEmptyString(value.entityId) ? value.entityId : entityIdFromPayload(value.resource, value.payload),
    revision: positiveInteger(value.revision, 1),
    schemaVersion,
    createdAt: value.createdAt,
    payload: value.payload
  };
}

function parseRosterStudent(value: unknown): EpsRosterStudent | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const studentId = nonEmptyString(value.studentId) ? value.studentId : nonEmptyString(value.id) ? value.id : undefined;
  const level = typeof value.level === "number" && Number.isFinite(value.level) ? Math.max(1, Math.min(5, value.level)) : undefined;
  const gender = value.gender === "F" || value.gender === "G" || value.gender === "" ? value.gender : undefined;
  const status = value.status === "present" || value.status === "absent" || value.status === "non-pratiquant" ? value.status : undefined;
  return { studentId, name: value.name.trim(), gender, level, status };
}

function normalizeRosterPayload(value: { classId?: unknown; groupId?: unknown; className?: unknown; students?: unknown; roster?: unknown }): EpsRosterPayload {
  const rawStudents = Array.isArray(value.students) ? value.students : Array.isArray(value.roster) ? value.roster : [];
  const students = rawStudents.map(parseRosterStudent).filter((student): student is EpsRosterStudent => !!student);
  return {
    classId: nonEmptyString(value.classId) ? value.classId : undefined,
    groupId: nonEmptyString(value.groupId) ? value.groupId : undefined,
    className: typeof value.className === "string" ? value.className.trim() : undefined,
    students
  };
}

export function parseRosterPayload(value: unknown): EpsRosterPayload | null {
  if (!isRecord(value)) return null;
  const payload = normalizeRosterPayload(value);
  return payload.students.length ? payload : null;
}

export function parseRosterEnvelope(value: unknown): EpsRosterPayload | null {
  const envelope = parseInteropEnvelope(value);
  if (!envelope || envelope.resource !== "sns-roster") return null;
  const payload = isRecord(envelope.payload) && "roster" in envelope.payload ? envelope.payload.roster : envelope.payload;
  return parseRosterPayload(payload);
}

export function createClassFromRoster(payload: EpsRosterPayload, sourceApp: string): SchoolClass {
  const normalizedSourceApp = canonicalizeApplicationId(sourceApp);
  return {
    id: uid("class"),
    externalId: payload.classId,
    sourceApp: normalizedSourceApp,
    name: payload.className || "Classe importée EPS",
    createdAt: new Date().toISOString(),
    students: payload.students.map((student) => ({
      id: uid("student"),
      externalId: student.studentId,
      sourceApp: normalizedSourceApp,
      name: student.name,
      gender: student.gender,
      level: student.level ?? 3,
      status: student.status ?? "present",
      points: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      refereed: 0
    }))
  };
}

export type InteropRevisionStatus = "applied" | "duplicate" | "stale" | "conflict" | "gap";

export interface InteropRevisionDecision {
  status: InteropRevisionStatus;
  currentRevision?: number;
  expectedRevision?: number;
}

interface RevisionState {
  revision: number;
  fingerprint: string;
}

export class InteropRevisionTracker {
  private readonly eventIds = new Map<string, string>();
  private readonly revisions = new Map<string, RevisionState>();

  accept(envelope: Pick<EpsInteropEnvelope, "eventId" | "entityId" | "revision" | "payload">): InteropRevisionDecision {
    const fingerprint = stableHash(envelope.payload);
    const seenFingerprint = this.eventIds.get(envelope.eventId);
    if (seenFingerprint !== undefined) return seenFingerprint === fingerprint ? { status: "duplicate" } : { status: "conflict" };

    const current = this.revisions.get(envelope.entityId);
    if (!current) {
      if (envelope.revision > 1) return { status: "gap", expectedRevision: 1 };
      this.eventIds.set(envelope.eventId, fingerprint);
      this.revisions.set(envelope.entityId, { revision: envelope.revision, fingerprint });
      return { status: "applied", currentRevision: envelope.revision };
    }
    if (envelope.revision < current.revision) {
      this.eventIds.set(envelope.eventId, fingerprint);
      return { status: "stale", currentRevision: current.revision };
    }
    if (envelope.revision === current.revision) {
      this.eventIds.set(envelope.eventId, fingerprint);
      return fingerprint === current.fingerprint ? { status: "duplicate", currentRevision: current.revision } : { status: "conflict", currentRevision: current.revision };
    }
    if (envelope.revision > current.revision + 1) return { status: "gap", currentRevision: current.revision, expectedRevision: current.revision + 1 };

    this.eventIds.set(envelope.eventId, fingerprint);
    this.revisions.set(envelope.entityId, { revision: envelope.revision, fingerprint });
    return { status: "applied", currentRevision: envelope.revision };
  }

  getRevision(entityId: string): number | undefined {
    return this.revisions.get(entityId)?.revision;
  }
}

export async function fetchInteropDocument(url: string, signal?: AbortSignal): Promise<EpsInteropEnvelope> {
  const target = url.trim();
  if (!/^https:\/\//i.test(target)) throw new Error("L’URL d’échange doit commencer par https://.");
  const response = await fetch(target, { signal, headers: { Accept: "application/json, application/eps.interop+json" } });
  if (!response.ok) throw new Error(`L’application EPS a répondu ${response.status}.`);
  const envelope = parseInteropEnvelope(await response.json());
  if (!envelope) throw new Error("Le document reçu n’est pas un échange EPS versionné.");
  return envelope;
}
