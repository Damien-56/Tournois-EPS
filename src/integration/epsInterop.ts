import { uid } from "../domain/ids";
import type { SchoolClass, Student } from "../domain/types";

export const EPS_INTEROP_SCHEMA = "eps.interop-envelope" as const;
export const EPS_INTEROP_VERSION = 1 as const;

export type EpsApplicationId =
  | "tournois-eps"
  | "intervalle-eps"
  | "crossscan"
  | "course-orientation"
  | "gestion-sns"
  | "tableau-de-bord-eps"
  | (string & {});

export type EpsInteropResource = "interval-session" | "cross-event" | "orientation-course" | "sns-roster" | "eps-context";
export type EpsInteropAction = "get" | "import" | "export" | "open";

export interface EpsInteropEnvelope<T = unknown> {
  schema: typeof EPS_INTEROP_SCHEMA;
  version: typeof EPS_INTEROP_VERSION;
  id: string;
  type: "request" | "data" | "response";
  source: { app: EpsApplicationId; version?: string };
  target?: { app: EpsApplicationId };
  resource: EpsInteropResource;
  action: EpsInteropAction;
  createdAt: string;
  correlationId?: string;
  payload: T;
  metadata?: Record<string, string>;
}

export interface EpsRosterStudent {
  id?: string;
  name: string;
  gender?: Student["gender"];
  level?: number;
  status?: Student["status"];
}

export interface EpsRosterPayload {
  classId?: string;
  className?: string;
  students: EpsRosterStudent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createInteropEnvelope<T>(options: {
  type?: EpsInteropEnvelope["type"];
  source: EpsApplicationId;
  sourceVersion?: string;
  target?: EpsApplicationId;
  resource: EpsInteropResource;
  action: EpsInteropAction;
  payload: T;
  correlationId?: string;
  metadata?: Record<string, string>;
}): EpsInteropEnvelope<T> {
  return {
    schema: EPS_INTEROP_SCHEMA,
    version: EPS_INTEROP_VERSION,
    id: uid("eps-interop"),
    type: options.type ?? "data",
    source: { app: options.source, version: options.sourceVersion },
    target: options.target ? { app: options.target } : undefined,
    resource: options.resource,
    action: options.action,
    createdAt: new Date().toISOString(),
    correlationId: options.correlationId,
    payload: options.payload,
    metadata: options.metadata
  };
}

export function createRosterInteropEnvelope(payload: EpsRosterPayload): EpsInteropEnvelope<EpsRosterPayload> {
  return createInteropEnvelope({ source: "tournois-eps", resource: "sns-roster", action: "export", payload, metadata: { format: "eps.sns-roster", schemaVersion: "1" } });
}

export function createInteropRequest(options: { source?: EpsApplicationId; target?: EpsApplicationId; resource: EpsInteropResource; filters?: Record<string, string> }): EpsInteropEnvelope<Record<string, string>> {
  return createInteropEnvelope({ type: "request", source: options.source ?? "tournois-eps", target: options.target, resource: options.resource, action: "get", payload: options.filters ?? {} });
}

export function parseInteropEnvelope(value: unknown): EpsInteropEnvelope | null {
  if (!isRecord(value) || value.schema !== EPS_INTEROP_SCHEMA || value.version !== EPS_INTEROP_VERSION) return null;
  if (typeof value.id !== "string" || typeof value.type !== "string" || !isRecord(value.source) || typeof value.source.app !== "string" || typeof value.resource !== "string" || typeof value.action !== "string" || typeof value.createdAt !== "string" || !("payload" in value)) return null;
  return value as unknown as EpsInteropEnvelope;
}

function parseRosterStudent(value: unknown): EpsRosterStudent | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const level = typeof value.level === "number" && Number.isFinite(value.level) ? Math.max(1, Math.min(5, value.level)) : undefined;
  const gender = value.gender === "F" || value.gender === "G" || value.gender === "" ? value.gender : undefined;
  const status = value.status === "present" || value.status === "absent" || value.status === "non-pratiquant" ? value.status : undefined;
  return { id: typeof value.id === "string" ? value.id : undefined, name: value.name.trim(), gender, level, status };
}

export function parseRosterPayload(value: unknown): EpsRosterPayload | null {
  if (!isRecord(value)) return null;
  const rawStudents = Array.isArray(value.students) ? value.students : Array.isArray(value.roster) ? value.roster : [];
  const students = rawStudents.map(parseRosterStudent).filter((student): student is EpsRosterStudent => !!student);
  if (!students.length) return null;
  return { classId: typeof value.classId === "string" ? value.classId : undefined, className: typeof value.className === "string" ? value.className.trim() : undefined, students };
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
      externalId: student.id,
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
