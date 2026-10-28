import { uid } from "../domain/ids";
import type { SchoolClass, Student } from "../domain/types";

export const EPS_INTEROP_SCHEMA = "eps.interop-envelope" as const;
export const EPS_INTEROP_VERSION = 1 as const;
export const EPS_INTEROP_RESOURCE_SCHEMA_VERSION = "2.0" as const;

export type EpsApplicationId =
  | "tournois-eps"
  | "intervalle-eps"
  | "crossscan"
  | "course-orientation"
  | "gestion-sns"
  | "tableau-de-bord-eps"
  | "tournois-sport-collectif"
  | "tournois-sport-individuel"
  | "acrosport-eps"
  | (string & {});

export type EpsInteropResource =
  | "interval-session"
  | "cross-event"
  | "orientation-course"
  | "sns-roster"
  | "eps-context";

export type EpsInteropAction = "get" | "import" | "export" | "open" | "upsert" | "delete";
export type EpsInteropType = "request" | "data" | "event" | "response";

export interface EpsInteropEnvelope<T = unknown> {
  schema: typeof EPS_INTEROP_SCHEMA;
  version: typeof EPS_INTEROP_VERSION;
  id: string;
  eventId: string;
  type: EpsInteropType;
  source: { app: EpsApplicationId; version: string };
  sourceApp: EpsApplicationId;
  target?: { app: EpsApplicationId };
  resource: EpsInteropResource;
  action: EpsInteropAction;
  entityId: string;
  revision: number;
  baseRevision?: number;
  schemaVersion: string;
  createdAt: string;
  correlationId?: string;
  payload: T;
  metadata?: Record<string, string>;
  migration?: { from: string; appliedAt: string; steps: string[] };
}

export interface EpsRosterStudent {
  studentId?: string;
  id?: string;
  name: string;
  gender?: Student["gender"];
  level?: number;
  status?: Student["status"];
}

export interface EpsRosterPayload {
  groupId?: string;
  classId?: string;
  className?: string;
  students: EpsRosterStudent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEnvelopeType(value: unknown): value is EpsInteropType {
  return value === "request" || value === "data" || value === "event" || value === "response";
}

function isEnvelopeAction(value: unknown): value is EpsInteropAction {
  return value === "get" || value === "import" || value === "export" || value === "open" || value === "upsert" || value === "delete";
}

function eventIdFor(value: Record<string, unknown>): string | undefined {
  if (typeof value.eventId === "string" && value.eventId.trim()) return value.eventId;
  if (typeof value.id === "string" && value.id.trim()) return value.id;
  return undefined;
}

function payloadEntityId(resource: unknown, payload: unknown): string | undefined {
  const direct = isRecord(payload) && "session" in payload ? payload.session : payload;
  if (!isRecord(direct)) return undefined;
  if (resource === "interval-session" && typeof direct.id === "string" && direct.id.trim()) return direct.id;
  if (typeof direct.entityId === "string" && direct.entityId.trim()) return direct.entityId;
  if (resource === "sns-roster" && typeof direct.groupId === "string" && direct.groupId.trim()) return `sns-roster:${direct.groupId}`;
  return undefined;
}

export function createInteropEnvelope<T>(options: {
  type?: EpsInteropType;
  source: EpsApplicationId;
  sourceVersion?: string;
  target?: EpsApplicationId;
  resource: EpsInteropResource;
  action: EpsInteropAction;
  payload: T;
  entityId?: string;
  eventId?: string;
  revision?: number;
  baseRevision?: number;
  correlationId?: string;
  metadata?: Record<string, string>;
}): EpsInteropEnvelope<T> {
  const eventId = options.eventId ?? uid("eps-interop");
  return {
    schema: EPS_INTEROP_SCHEMA,
    version: EPS_INTEROP_VERSION,
    id: eventId,
    eventId,
    type: options.type ?? "data",
    source: { app: options.source, version: options.sourceVersion ?? "0.1.0" },
    sourceApp: options.source,
    target: options.target ? { app: options.target } : undefined,
    resource: options.resource,
    action: options.action,
    entityId: options.entityId ?? `${options.resource}:${eventId}`,
    revision: options.revision ?? 1,
    baseRevision: options.baseRevision,
    schemaVersion: EPS_INTEROP_RESOURCE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    correlationId: options.correlationId,
    payload: options.payload,
    metadata: options.metadata
  };
}

export function createRosterInteropEnvelope(payload: EpsRosterPayload): EpsInteropEnvelope<EpsRosterPayload> {
  const canonicalPayload: EpsRosterPayload = {
    ...payload,
    students: payload.students.map((student) => ({
      ...student,
      studentId: student.studentId ?? student.id
    }))
  };
  return createInteropEnvelope({
    source: "tournois-eps",
    resource: "sns-roster",
    action: "export",
    entityId: payload.groupId ? `sns-roster:${payload.groupId}` : undefined,
    payload: canonicalPayload,
    metadata: { format: "eps.sns-roster", schemaVersion: EPS_INTEROP_RESOURCE_SCHEMA_VERSION }
  });
}

export function createInteropRequest(options: {
  source?: EpsApplicationId;
  target?: EpsApplicationId;
  resource: EpsInteropResource;
  filters?: Record<string, string>;
}): EpsInteropEnvelope<Record<string, string>> {
  return createInteropEnvelope({
    type: "request",
    source: options.source ?? "tournois-eps",
    target: options.target,
    resource: options.resource,
    action: "get",
    payload: options.filters ?? {}
  });
}

export function parseInteropEnvelope(value: unknown): EpsInteropEnvelope | null {
  if (!isRecord(value) || value.schema !== EPS_INTEROP_SCHEMA || value.version !== EPS_INTEROP_VERSION) return null;

  const eventId = eventIdFor(value);
  const source = isRecord(value.source) && typeof value.source.app === "string" ? value.source.app : undefined;
  if (!eventId || !source || !isEnvelopeType(value.type) || typeof value.resource !== "string" ||
    !isEnvelopeAction(value.action) || typeof value.createdAt !== "string" || !("payload" in value)) return null;

  const sourceVersion = isRecord(value.source) && typeof value.source.version === "string"
    ? value.source.version
    : "0.0.0-legacy";
  const payloadId = payloadEntityId(value.resource, value.payload);
  const schemaVersion = typeof value.schemaVersion === "string"
    ? value.schemaVersion
    : isRecord(value.metadata) && typeof value.metadata.schemaVersion === "string"
      ? value.metadata.schemaVersion
      : "1.0";

  return {
    ...value,
    id: eventId,
    eventId,
    source: { app: source, version: sourceVersion },
    sourceApp: typeof value.sourceApp === "string" ? value.sourceApp : source,
    entityId: typeof value.entityId === "string" && value.entityId.trim()
      ? value.entityId
      : payloadId ?? eventId,
    revision: Number.isInteger(value.revision) && Number(value.revision) >= 1 ? Number(value.revision) : 1,
    schemaVersion,
    resource: value.resource as EpsInteropResource,
    action: value.action,
    type: value.type,
    payload: value.payload
  } as EpsInteropEnvelope;
}

function parseRosterStudent(value: unknown): EpsRosterStudent | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const studentId = typeof value.studentId === "string" && value.studentId.trim()
    ? value.studentId
    : typeof value.id === "string" && value.id.trim()
      ? value.id
      : undefined;
  const level = typeof value.level === "number" && Number.isFinite(value.level)
    ? Math.max(1, Math.min(5, value.level))
    : undefined;
  const gender = value.gender === "F" || value.gender === "G" || value.gender === "" ? value.gender : undefined;
  const status = value.status === "present" || value.status === "absent" || value.status === "non-pratiquant"
    ? value.status
    : undefined;
  return { studentId, name: value.name.trim(), gender, level, status };
}

export function parseRosterPayload(value: unknown): EpsRosterPayload | null {
  if (!isRecord(value)) return null;
  const rawStudents = Array.isArray(value.students) ? value.students : Array.isArray(value.roster) ? value.roster : [];
  const students = rawStudents.map(parseRosterStudent).filter((student): student is EpsRosterStudent => !!student);
  if (!students.length) return null;
  return {
    groupId: typeof value.groupId === "string" ? value.groupId : undefined,
    classId: typeof value.classId === "string" ? value.classId : undefined,
    className: typeof value.className === "string" ? value.className.trim() : undefined,
    students
  };
}

export function parseRosterEnvelope(value: unknown): EpsRosterPayload | null {
  const envelope = parseInteropEnvelope(value);
  if (!envelope || (envelope.resource !== "sns-roster" && envelope.resource !== "eps-context")) return null;
  const payload = isRecord(envelope.payload) && "roster" in envelope.payload ? envelope.payload.roster : envelope.payload;
  return parseRosterPayload(payload);
}

export function createClassFromRoster(payload: EpsRosterPayload, sourceApp: string): SchoolClass {
  return {
    id: uid("class"),
    externalId: payload.classId,
    sourceApp,
    name: payload.className || "Classe importée EPS",
    createdAt: new Date().toISOString(),
    students: payload.students.map((student) => ({
      id: uid("student"),
      externalId: student.studentId ?? student.id,
      sourceApp,
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

export async function fetchInteropDocument(url: string, signal?: AbortSignal): Promise<EpsInteropEnvelope> {
  const target = url.trim();
  if (!/^https:\/\//i.test(target)) throw new Error("L’URL d’échange doit commencer par https://.");
  const response = await fetch(target, { signal, headers: { Accept: "application/json, application/eps.interop+json" } });
  if (!response.ok) throw new Error(`L’application EPS a répondu ${response.status}.`);
  const envelope = parseInteropEnvelope(await response.json());
  if (!envelope) throw new Error("Le document reçu n’est pas un échange EPS versionné.");
  return envelope;
}
