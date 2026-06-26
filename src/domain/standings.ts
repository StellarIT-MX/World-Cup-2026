// Calculo de tablas de grupo con los criterios de desempate FIFA World Cup 2026 (art. 12.4).
//
// Orden de criterios:
//   1. Puntos (todos los partidos del grupo)
//   --- entre equipos empatados en puntos, "mini-liga" head-to-head: ---
//   2. Puntos en los partidos entre los equipos empatados
//   3. Diferencia de gol en esos partidos
//   4. Goles a favor en esos partidos
//      (si 2-4 separan a unos pero no a todos, se REAPLICAN 2-4 solo a los que siguen empatados)
//   --- si el head-to-head no separa: ---
//   5. Diferencia de gol global
//   6. Goles a favor global
//   7. Fair play (menos puntos de sancion = mejor)
//   8. Ranking FIFA (mas bajo = mejor)

import type { Fixture, GroupLetter, ResultsMap, StandingRow, Team, TeamStats } from './types';

interface PlayedMatch {
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
  homeFairPlay: number;
  awayFairPlay: number;
}

/** Partidos de grupo TERMINADOS, normalizados. */
export function playedGroupMatches(
  fixtures: Fixture[],
  results: ResultsMap,
  group: GroupLetter,
): PlayedMatch[] {
  const out: PlayedMatch[] = [];
  for (const f of fixtures) {
    if (f.stage !== 'group' || f.group !== group) continue;
    const r = results[String(f.id)];
    if (!r || !r.finished) continue;
    if (f.home.kind !== 'team' || f.away.kind !== 'team') continue;
    out.push({
      homeId: f.home.teamId,
      awayId: f.away.teamId,
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
      homeFairPlay: r.homeFairPlay ?? 0,
      awayFairPlay: r.awayFairPlay ?? 0,
    });
  }
  return out;
}

/** Acumula estadisticas de `teamIds` considerando solo `matches` entre esos equipos. */
export function accumulate(teamIds: number[], matches: PlayedMatch[]): Map<number, TeamStats> {
  const set = new Set(teamIds);
  const stats = new Map<number, TeamStats>();
  for (const id of teamIds) {
    stats.set(id, {
      teamId: id, played: 0, won: 0, drawn: 0, lost: 0,
      gf: 0, ga: 0, gd: 0, points: 0, fairPlay: 0,
    });
  }
  for (const m of matches) {
    if (!set.has(m.homeId) || !set.has(m.awayId)) continue;
    const h = stats.get(m.homeId)!;
    const a = stats.get(m.awayId)!;
    h.played++; a.played++;
    h.gf += m.homeGoals; h.ga += m.awayGoals;
    a.gf += m.awayGoals; a.ga += m.homeGoals;
    h.fairPlay += m.homeFairPlay;
    a.fairPlay += m.awayFairPlay;
    if (m.homeGoals > m.awayGoals) { h.won++; a.lost++; h.points += 3; }
    else if (m.homeGoals < m.awayGoals) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points += 1; a.points += 1; }
  }
  for (const s of stats.values()) s.gd = s.gf - s.ga;
  return stats;
}

const cmpTriple = (a: TeamStats, b: TeamStats) =>
  b.points - a.points || b.gd - a.gd || b.gf - a.gf;

/** Particiona una lista YA ordenada por `key` en bloques de elementos con key identica. */
function partition<T>(sorted: T[], equal: (x: T, y: T) => boolean): T[][] {
  const blocks: T[][] = [];
  for (const item of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && equal(last[0], item)) last.push(item);
    else blocks.push([item]);
  }
  return blocks;
}

/**
 * Ordena un bloque de equipos empatados en PUNTOS, aplicando head-to-head (criterios 2-4)
 * con reaplicacion recursiva, y cayendo a criterios globales 5-8 cuando el h2h no separa.
 */
function breakTie(
  block: TeamStats[],
  allMatches: PlayedMatch[],
  teamById: Map<number, Team>,
): TeamStats[] {
  if (block.length === 1) return block;

  const ids = block.map((s) => s.teamId);
  const h2h = accumulate(ids, allMatches);
  const sorted = block
    .map((s) => h2h.get(s.teamId)!)
    .sort(cmpTriple);

  const blocks = partition(sorted, (x, y) => cmpTriple(x, y) === 0);

  // El head-to-head no separo a NADIE -> criterios globales 5-8 sobre el bloque original.
  if (blocks.length === 1) return sortByOverall(block, teamById);

  // Separacion (total o parcial): respetar el orden h2h y reaplicar dentro de cada sub-bloque.
  const result: TeamStats[] = [];
  for (const sub of blocks) {
    if (sub.length === 1) {
      result.push(byId(block, sub[0].teamId));
    } else {
      const subOriginal = sub.map((s) => byId(block, s.teamId));
      result.push(...breakTie(subOriginal, allMatches, teamById));
    }
  }
  return result;
}

function sortByOverall(block: TeamStats[], teamById: Map<number, Team>): TeamStats[] {
  return block.slice().sort(
    (a, b) =>
      b.gd - a.gd ||
      b.gf - a.gf ||
      b.fairPlay - a.fairPlay || // menos negativo = mejor
      (teamById.get(a.teamId)?.fifaRank ?? 99) - (teamById.get(b.teamId)?.fifaRank ?? 99),
  );
}

const byId = (block: TeamStats[], id: number) => block.find((s) => s.teamId === id)!;

/** Tabla ordenada de un grupo (con stats GLOBALES por equipo y rank 1..4). */
export function computeGroupStandings(
  teams: Team[],
  fixtures: Fixture[],
  results: ResultsMap,
  group: GroupLetter,
): StandingRow[] {
  const groupTeams = teams.filter((t) => t.group === group);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matches = playedGroupMatches(fixtures, results, group);

  // Stats globales (todos los partidos del grupo).
  const overall = accumulate(groupTeams.map((t) => t.id), matches);

  // Ordenar por puntos, luego desempatar bloque por bloque.
  const byPoints = [...overall.values()].sort((a, b) => b.points - a.points);
  const pointBlocks = partition(byPoints, (x, y) => x.points === y.points);

  const ordered: TeamStats[] = [];
  for (const blk of pointBlocks) ordered.push(...breakTie(blk, matches, teamById));

  return ordered.map((s, i) => ({ ...s, rank: i + 1 }));
}

const GROUPS: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** Standings de los 12 grupos. */
export function computeAllStandings(
  teams: Team[],
  fixtures: Fixture[],
  results: ResultsMap,
): Record<GroupLetter, StandingRow[]> {
  const out = {} as Record<GroupLetter, StandingRow[]>;
  for (const g of GROUPS) out[g] = computeGroupStandings(teams, fixtures, results, g);
  return out;
}

/** Un grupo esta "decidido" cuando sus 6 partidos terminaron. */
export function groupComplete(fixtures: Fixture[], results: ResultsMap, group: GroupLetter): boolean {
  const gf = fixtures.filter((f) => f.stage === 'group' && f.group === group);
  return gf.length > 0 && gf.every((f) => results[String(f.id)]?.finished);
}

export { GROUPS };
