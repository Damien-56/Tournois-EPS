export function isAtpMatchAllowed(rankA: number | undefined, rankB: number | undefined, maxRankDiff: number): boolean {
  return rankA === undefined || rankB === undefined || Math.abs(rankA - rankB) <= Math.max(0, maxRankDiff);
}

export function getPouleCourt(matchCount: number, courtCount: number): number {
  return (Math.max(0, matchCount) % Math.max(1, courtCount)) + 1;
}

export function splitIntoGroups<T>(items: T[], groupSize: number): T[][] {
  const size = Math.max(1, Math.floor(groupSize));
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}
