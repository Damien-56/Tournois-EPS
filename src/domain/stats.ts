import type { SchoolClass, Student, Tournament } from "./types";

export interface StudentPerformance extends Student {
  rank: number;
  winRate: number;
  badges: string[];
}

const blankCounters = (student: Student): Student => ({
  ...student,
  points: 0,
  matches: 0,
  wins: 0,
  losses: 0,
  refereed: 0,
});

/** Rebuild counters from match history so deleting/correcting a result is safe. */
export function recalculateClassStats(classItem: SchoolClass, tournaments: Tournament[]): SchoolClass {
  const students = classItem.students.map(blankCounters);
  const byId = new Map(students.map((student) => [student.id, student]));
  for (const tournament of tournaments) {
    if (tournament.classId !== classItem.id) continue;
    for (const match of tournament.matches) {
      const a = byId.get(match.playerAId);
      const b = byId.get(match.playerBId);
      if (!a || !b || match.scoreA === match.scoreB) continue;
      const winner = match.scoreA > match.scoreB ? a : b;
      const loser = winner.id === a.id ? b : a;
      winner.points += tournament.pointsWin;
      winner.matches += 1;
      winner.wins += 1;
      loser.points += tournament.pointsLoss;
      loser.matches += 1;
      loser.losses += 1;
      if (match.refereeId) {
        const referee = byId.get(match.refereeId);
        if (referee && referee.id !== winner.id && referee.id !== loser.id) {
          referee.points += 1;
          referee.refereed += 1;
        }
      }
    }
  }
  return { ...classItem, students };
}

export function getStudentBadges(student: Student): string[] {
  const badges: string[] = [];
  if (student.wins >= 1) badges.push("Première victoire");
  if (student.wins >= 3) badges.push("Série gagnante");
  if (student.matches >= 5) badges.push("Régulier");
  if (student.refereed >= 3) badges.push("Jeune arbitre");
  if (student.wins > 0 && student.losses === 0) badges.push("Invaincu");
  return badges;
}

export function getClassPerformance(classItem: SchoolClass): StudentPerformance[] {
  const ranking = [...classItem.students].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  return ranking.map((student, index) => ({
    ...student,
    rank: index + 1,
    winRate: student.matches ? Math.round((student.wins / student.matches) * 100) : 0,
    badges: getStudentBadges(student),
  }));
}

export function getTargetScore(format: Tournament["matchFormat"], configured?: number): number {
  return configured && configured > 0 ? configured : format === "flash" ? 11 : 21;
}
