import { describe, expect, it } from "vitest";
import { getClassPerformance, getTargetScore, recalculateClassStats } from "./stats";
import type { SchoolClass, Tournament } from "./types";

const fixture = (): { schoolClass: SchoolClass; tournament: Tournament } => {
  const schoolClass: SchoolClass = {
    id: "class-1", name: "5e A", createdAt: "2026-01-01", students: [
      { id: "a", name: "Alice", level: 3, status: "present", points: 99, matches: 9, wins: 9, losses: 0, refereed: 0 },
      { id: "b", name: "Benoît", level: 3, status: "present", points: 99, matches: 9, wins: 9, losses: 0, refereed: 0 },
      { id: "r", name: "Rita", level: 3, status: "present", points: 0, matches: 0, wins: 0, losses: 0, refereed: 0 },
    ],
  };
  const tournament: Tournament = { id: "t-1", classId: schoolClass.id, name: "Badminton", sport: "badminton", mode: "classic", createdAt: "2026-01-01", pointsWin: 3, pointsLoss: 1, maxRankDiff: 3, courtCount: 1, groupSize: 4, matchFormat: "normal", matches: [{ id: "m-1", tournamentId: "t-1", playerAId: "a", playerBId: "b", scoreA: 21, scoreB: 15, refereeId: "r", playedAt: "2026-01-01" }] };
  return { schoolClass, tournament };
};

describe("statistiques et recalcul", () => {
  it("reconstruit les compteurs depuis l'historique", () => {
    const { schoolClass, tournament } = fixture();
    const result = recalculateClassStats(schoolClass, [tournament]);
    expect(result.students.find((student) => student.id === "a")).toMatchObject({ points: 3, matches: 1, wins: 1, losses: 0 });
    expect(result.students.find((student) => student.id === "b")).toMatchObject({ points: 1, matches: 1, wins: 0, losses: 1 });
    expect(result.students.find((student) => student.id === "r")).toMatchObject({ points: 1, refereed: 1 });
  });

  it("calcule un taux de victoire et des badges", () => {
    const { schoolClass, tournament } = fixture();
    const [alice] = getClassPerformance(recalculateClassStats(schoolClass, [tournament]));
    expect(alice.winRate).toBe(100);
    expect(alice.badges).toContain("Première victoire");
  });

  it("propose une cible adaptée au format", () => {
    expect(getTargetScore("normal")).toBe(21);
    expect(getTargetScore("flash")).toBe(11);
    expect(getTargetScore("flash", 7)).toBe(7);
  });
});
