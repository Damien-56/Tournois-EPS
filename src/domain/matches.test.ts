import { describe, expect, it } from "vitest";
import { isValidMatchResult, replaceTournamentMatch } from "./matches";
import type { Tournament } from "./types";

const tournament = (): Tournament => ({
  id: "t-1",
  classId: "class-1",
  name: "Séance",
  mode: "classic",
  createdAt: "2026-01-01",
  pointsWin: 3,
  pointsLoss: 1,
  maxRankDiff: 3,
  courtCount: 1,
  groupSize: 4,
  matchFormat: "normal",
  matches: [{ id: "m-1", tournamentId: "t-1", playerAId: "a", playerBId: "b", scoreA: 21, scoreB: 15, playedAt: "2026-01-01T10:00:00Z", court: 1 }],
});

describe("correction des matchs", () => {
  it("remplace un match existant sans changer son identifiant ni sa date", () => {
    const result = replaceTournamentMatch(tournament(), { ...tournament().matches[0], scoreA: 15, scoreB: 21, refereeId: "r" });
    expect(result?.matches).toHaveLength(1);
    expect(result?.matches[0]).toMatchObject({ id: "m-1", scoreA: 15, scoreB: 21, refereeId: "r", playedAt: "2026-01-01T10:00:00Z", court: 1 });
  });

  it("refuse les résultats impossibles ou les matchs inconnus", () => {
    expect(isValidMatchResult({ playerAId: "a", playerBId: "b", scoreA: 21, scoreB: 15 })).toBe(true);
    expect(isValidMatchResult({ playerAId: "a", playerBId: "a", scoreA: 21, scoreB: 15 })).toBe(false);
    expect(isValidMatchResult({ playerAId: "a", playerBId: "b", scoreA: 21, scoreB: 21 })).toBe(false);
    expect(replaceTournamentMatch(tournament(), { ...tournament().matches[0], id: "unknown" })).toBeUndefined();
  });
});
