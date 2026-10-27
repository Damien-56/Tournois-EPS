import { describe, expect, it } from "vitest";
import { createInteropRequest, createRosterInteropEnvelope, parseInteropEnvelope, parseRosterEnvelope } from "./epsInterop";

describe("Contrat d’interopérabilité EPS", () => {
  it("crée et relit une enveloppe de liste d’élèves", () => {
    const envelope = createRosterInteropEnvelope({ className: "5e A", students: [{ id: "a1", name: "Camille", level: 4 }] });
    expect(parseInteropEnvelope(envelope)?.resource).toBe("sns-roster");
    expect(parseRosterEnvelope(envelope)?.students[0].name).toBe("Camille");
  });

  it("crée une demande versionnée vers une application EPS", () => {
    const request = createInteropRequest({ target: "gestion-sns", resource: "sns-roster", filters: { className: "5e A" } });
    expect(request.type).toBe("request");
    expect(request.action).toBe("get");
    expect(request.payload).toEqual({ className: "5e A" });
  });

  it("refuse une version inconnue", () => {
    expect(parseInteropEnvelope({ schema: "eps.interop-envelope", version: 99 })).toBeNull();
  });
});
