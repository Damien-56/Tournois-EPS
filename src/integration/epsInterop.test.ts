import { describe, expect, it } from "vitest";
import {
  CANONICAL_APPLICATION_ID,
  InteropRevisionTracker,
  createAttendanceEnvelope,
  createIndividualResultEnvelope,
  createIndividualTournamentEnvelope,
  parseInteropEnvelope,
  parseRosterEnvelope
} from "./epsInterop";

const tournamentPayload = {
  eventId: "event-1",
  activityId: "activity-badminton",
  players: [{ studentId: "student-1" }, { studentId: "student-2" }],
  matches: [{ playerAId: "student-1", playerBId: "student-2", scoreA: 21, scoreB: 18 }]
};

describe("Enveloppe EPS canonique", () => {
  it("produit exactement la forme canonique d’un tournoi", () => {
    const envelope = createIndividualTournamentEnvelope({
      source: { app: CANONICAL_APPLICATION_ID, version: "1.2.3" },
      target: { app: "tableau-de-bord-eps" },
      revision: 2,
      payload: tournamentPayload
    });

    expect(Object.keys(envelope).sort()).toEqual([
      "action", "createdAt", "entityId", "eventId", "payload", "resource", "revision", "schema", "schemaVersion", "source", "sourceApp", "target", "type", "version"
    ].sort());
    expect(envelope).toMatchObject({
      schema: "eps.interop-envelope",
      version: 1,
      eventId: "event-1",
      type: "event",
      source: { app: CANONICAL_APPLICATION_ID, version: "1.2.3" },
      sourceApp: CANONICAL_APPLICATION_ID,
      target: { app: "tableau-de-bord-eps" },
      resource: "individual-tournament",
      action: "upsert",
      entityId: "event-1",
      revision: 2,
      schemaVersion: "2.0",
      payload: tournamentPayload
    });
    expect(JSON.stringify(envelope)).not.toContain("tournois-eps");
  });

  it("utilise export uniquement lorsque l’appelant le demande explicitement", () => {
    const envelope = createIndividualResultEnvelope({
      action: "export",
      payload: { resultId: "result-1", eventId: "event-1", studentId: "student-1", score: 21 }
    });
    expect(envelope.action).toBe("export");
  });

  it("canonicalise un alias legacy fourni au créateur", () => {
    const envelope = createIndividualResultEnvelope({
      source: { app: "tournois-eps", version: "0.9.0" },
      payload: { resultId: "result-legacy", eventId: "event-legacy", studentId: "student-1", score: 18 }
    });
    expect(envelope.source).toEqual({ app: CANONICAL_APPLICATION_ID, version: "0.9.0" });
    expect(envelope.sourceApp).toBe(CANONICAL_APPLICATION_ID);
    expect(JSON.stringify(envelope)).not.toContain("tournois-eps");
  });

  it("produit les trois ressources et leurs payloads obligatoires", () => {
    const result = createIndividualResultEnvelope({
      payload: { resultId: "result-1", eventId: "event-1", studentId: "student-1", score: 21 }
    });
    const attendance = createAttendanceEnvelope({
      payload: { studentId: "student-1", classId: "class-1", sessionId: "session-1", status: "present", changedAt: "2026-10-28T10:00:00.000Z" }
    });

    expect(result).toMatchObject({ resource: "individual-result", type: "event", action: "upsert", schemaVersion: "2.0", entityId: "result-1", eventId: "event-1" });
    expect(result.payload).toEqual({ resultId: "result-1", eventId: "event-1", studentId: "student-1", score: 21 });
    expect(attendance).toMatchObject({ resource: "attendance", type: "event", action: "upsert", schemaVersion: "2.0", entityId: "session-1:student-1" });
    expect(attendance.payload).toMatchObject({ studentId: "student-1", classId: "class-1", sessionId: "session-1", status: "present", changedAt: "2026-10-28T10:00:00.000Z" });
  });

  it("refuse les payloads incomplets", () => {
    expect(() => createIndividualTournamentEnvelope({ payload: { eventId: "event-1", activityId: "activity-1", players: [] } as never })).toThrow();
    expect(() => createIndividualResultEnvelope({ payload: { resultId: "result-1", eventId: "event-1", studentId: "student-1", score: "21" } as never })).toThrow();
    expect(() => createAttendanceEnvelope({ payload: { studentId: "student-1", classId: "class-1", sessionId: "session-1", status: "present" } as never })).toThrow();
  });
});

describe("Lecture legacy EPS", () => {
  it("convertit id, source.app et student.id sans les réémettre", () => {
    const legacy = {
      schema: "eps.interop-envelope",
      version: 1,
      id: "old-event-1",
      type: "data",
      source: { app: "tournois-eps", version: "0.9.0" },
      targetApp: "tableau-de-bord-eps",
      resource: "sns-roster",
      action: "export",
      createdAt: "2026-10-28T10:00:00.000Z",
      payload: { classId: "class-1", students: [{ id: "student-1", name: "Camille" }] }
    };
    const parsed = parseInteropEnvelope(legacy);
    const roster = parseRosterEnvelope(legacy);

    expect(parsed).toMatchObject({
      eventId: "old-event-1",
      type: "event",
      source: { app: CANONICAL_APPLICATION_ID, version: "0.9.0" },
      sourceApp: CANONICAL_APPLICATION_ID,
      target: { app: "tableau-de-bord-eps" },
      schemaVersion: "2.0"
    });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("targetApp");
    expect(roster?.students[0]).toMatchObject({ studentId: "student-1" });
    expect(roster?.students[0]).not.toHaveProperty("id");
  });

  it("limite parseRosterEnvelope à l’ancienne ressource sns-roster", () => {
    const envelope = {
      schema: "eps.interop-envelope",
      version: 1,
      id: "old-event-2",
      type: "data",
      source: { app: "gestion-sns" },
      resource: "eps-context",
      action: "export",
      createdAt: "2026-10-28T10:00:00.000Z",
      payload: { classId: "class-1", students: [{ id: "student-1", name: "Camille" }] }
    };
    expect(parseRosterEnvelope(envelope)).toBeNull();
  });
});

describe("Révisions d’interopérabilité", () => {
  it("distingue applied, duplicate, stale, conflict et gap", () => {
    const tracker = new InteropRevisionTracker();
    const event = (eventId: string, revision: number, score: number) => ({ eventId, entityId: "result-1", revision, payload: { score } });

    expect(tracker.accept(event("event-1", 1, 21))).toMatchObject({ status: "applied" });
    expect(tracker.accept(event("event-1", 1, 21))).toMatchObject({ status: "duplicate" });
    expect(tracker.accept(event("event-2", 1, 21))).toMatchObject({ status: "duplicate" });
    expect(tracker.accept(event("event-3", 1, 22))).toMatchObject({ status: "conflict", currentRevision: 1 });
    expect(tracker.accept(event("event-4", 3, 23))).toMatchObject({ status: "gap", expectedRevision: 2 });
    expect(tracker.accept(event("event-5", 2, 23))).toMatchObject({ status: "applied", currentRevision: 2 });
    expect(tracker.accept(event("event-6", 1, 21))).toMatchObject({ status: "stale", currentRevision: 2 });
    expect(tracker.getRevision("result-1")).toBe(2);
  });
});
