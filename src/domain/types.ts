export type TournamentMode = "atp" | "classic" | "poule";
export type StudentStatus = "present" | "absent" | "non-pratiquant";
export type Sport = "badminton" | "tennis-table" | "autre";

export interface Student {
  id: string;
  name: string;
  gender?: "F" | "G" | "";
  level: number;
  status: StudentStatus;
  points: number;
  matches: number;
  wins: number;
  losses: number;
  refereed: number;
  notes?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  students: Student[];
  createdAt: string;
  exitPin?: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  refereeId?: string;
  playedAt: string;
  round?: number;
  court?: number;
}

export interface Tournament {
  id: string;
  classId: string;
  name: string;
  sport?: Sport;
  mode: TournamentMode;
  createdAt: string;
  pointsWin: number;
  pointsLoss: number;
  maxRankDiff: number;
  courtCount: number;
  groupSize: number;
  matchFormat: "normal" | "flash";
  targetScore?: number;
  matches: Match[];
}

export interface TournamentStore {
  version: 1;
  classes: SchoolClass[];
  tournaments: Tournament[];
  selectedClassId?: string;
}
