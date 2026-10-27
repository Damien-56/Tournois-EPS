import type { Match, Tournament } from "./types";

export function isValidMatchResult(match: Pick<Match, "playerAId" | "playerBId" | "scoreA" | "scoreB">): boolean {
  return Boolean(
    match.playerAId &&
      match.playerBId &&
      match.playerAId !== match.playerBId &&
      Number.isInteger(match.scoreA) &&
      Number.isInteger(match.scoreB) &&
      match.scoreA >= 0 &&
      match.scoreB >= 0 &&
      match.scoreA !== match.scoreB,
  );
}

export function replaceTournamentMatch(tournament: Tournament, match: Match): Tournament | undefined {
  if (match.tournamentId !== tournament.id) return undefined;
  const index = tournament.matches.findIndex((item) => item.id === match.id);
  if (index < 0) return undefined;
  const matches = [...tournament.matches];
  matches[index] = match;
  return { ...tournament, matches };
}
