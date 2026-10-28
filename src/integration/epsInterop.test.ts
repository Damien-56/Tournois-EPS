import { describe, expect, it } from "vitest";
import { createInteropRequest, createRosterInteropEnvelope, parseInteropEnvelope, parseRosterEnvelope } from "./epsInterop";

describe("Contrat d’interopérabilité EPS", () => {
  it("crée une enveloppe SNS canonique et la relit", () => {
    const envelope = createRosterInteropEnvelope({
      groupId: "5e-a",
      className: "5e A",
      students: [{ id: "a1", name: "Camille", level: 4 }]
    });
    expect(envelope.eventId).toBe(envelope.id);
    expect(envelope.sourceApp).toBe("tournois-eps");
    expect(envelope.entityId).toBe("sns-roster:5e-a");
    expect(envelope.revision).toBe(1);
    expect(envelope.schemaVersion).toBe("2.0");
    expect(parseInteropEnvelope(envelope)?.resource).toBe("sns-roster");
    expect(parseRosterEnvelope(envelope)?.students[0].studentId).toBe("a1");
  });

  it("crée une demande versionnée vers une application EPS", () => {
    const request = createInteropRequest({ target: "gestion-sns", resource: "sns-roster", filters: { className: "5e A" } });
    expect(request.type).toBe("request");
    expect(request.action).toBe("get");
    expect(request.payload).toEqual({ className: "5e A" });
    expect(request.schemaVersion).toBe("2.0");
  });

  it("relit une enveloppe legacy sans perdre son identifiant d’événement", () => {
    const legacy = {
      schema: "eps.interop-envelope",
      version: 1,
      id: "legacy-1",
      type: "data",
      source: { app: "gestion-sns" },
      resource: "sns-roster",
      action: "export",
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: { students: [{ id: "a1", name: "Camille" }] }
    };
    const parsed = parseInteropEnvelope(legacy);
    expect(parsed?.eventId).toBe("legacy-1");
    expect(parsed?.source.version).toBe("0.0.0-legacy");
    expect(parsed?.schemaVersion).toBe("1.0");
    expect(parseRosterEnvelope(legacy)?.students[0].studentId).toBe("a1");
  });

  it("refuse une version inconnue", () => {
    expect(parseInteropEnvelope({ schema: "eps.interop-envelope", version: 99 })).toBeNull();
  });
});
