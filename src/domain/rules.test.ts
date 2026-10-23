import { describe, expect, it } from "vitest";
import { getPouleCourt, isAtpMatchAllowed, splitIntoGroups } from "./rules";

describe("règles de tournoi EPS", () => {
  it("respecte l'écart maximum ATP", () => {
    expect(isAtpMatchAllowed(1, 3, 2)).toBe(true);
    expect(isAtpMatchAllowed(1, 4, 2)).toBe(false);
  });

  it("répartit les matchs de poule sur les terrains", () => {
    expect([0, 1, 2, 3].map((count) => getPouleCourt(count, 2))).toEqual([1, 2, 1, 2]);
  });

  it("découpe l'effectif en groupes configurables", () => {
    expect(splitIntoGroups(["A", "B", "C", "D", "E"], 2)).toEqual([["A", "B"], ["C", "D"], ["E"]]);
  });
});
