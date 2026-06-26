// Ranking de los 12 terceros lugares y asignacion de los 8 mejores al bracket (Anexo C FIFA).
//
// Criterios de ranking de terceros (art. 12.5): puntos, dif. de gol, goles a favor,
// fair play, ranking FIFA.

import type { AnnexeC, GroupLetter, StandingRow, Team } from './types';
import { GROUPS } from './standings';

export interface ThirdPlaceRow {
  group: GroupLetter;
  teamId: number;
  played: number;
  points: number;
  gd: number;
  gf: number;
  fairPlay: number;
  thirdRank: number; // 1..12
  qualifies: boolean; // true para los 8 mejores
}

export interface ThirdAllocation {
  combo: string; // p.ej. "ABCDEFGH"
  /** grupo del ganador (1X) -> tercero asignado a su llave */
  byWinnerGroup: Partial<Record<GroupLetter, { group: GroupLetter; teamId: number }>>;
}

/** Ordena los 12 terceros y marca los 8 que clasifican. */
export function rankThirdPlaced(
  standings: Record<GroupLetter, StandingRow[]>,
  teams: Team[],
): ThirdPlaceRow[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const thirds = GROUPS.map((g) => {
    const row = standings[g].find((r) => r.rank === 3);
    return { group: g, row };
  }).filter((x): x is { group: GroupLetter; row: StandingRow } => !!x.row);

  const sorted = thirds.sort((a, b) => {
    const x = a.row, y = b.row;
    return (
      y.points - x.points ||
      y.gd - x.gd ||
      y.gf - x.gf ||
      y.fairPlay - x.fairPlay ||
      (teamById.get(x.teamId)?.fifaRank ?? 99) - (teamById.get(y.teamId)?.fifaRank ?? 99)
    );
  });

  return sorted.map(({ group, row }, i) => ({
    group,
    teamId: row.teamId,
    played: row.played,
    points: row.points,
    gd: row.gd,
    gf: row.gf,
    fairPlay: row.fairPlay,
    thirdRank: i + 1,
    qualifies: i < 8,
  }));
}

/**
 * Resuelve la asignacion de los 8 terceros a las llaves usando el Anexo C.
 * Devuelve null si aun no se conocen los 8 terceros definitivos.
 */
export function resolveThirdAllocation(
  thirdRows: ThirdPlaceRow[],
  annexe: AnnexeC,
): ThirdAllocation | null {
  const top8 = thirdRows.filter((r) => r.qualifies);
  if (top8.length < 8) return null;

  const combo = top8.map((r) => r.group).sort().join('');
  const map = annexe[combo];
  if (!map) return null;

  const teamByGroup = new Map(top8.map((r) => [r.group, r.teamId]));
  const byWinnerGroup: ThirdAllocation['byWinnerGroup'] = {};
  for (const [winnerGroup, thirdGroup] of Object.entries(map)) {
    const teamId = teamByGroup.get(thirdGroup as GroupLetter);
    if (teamId !== undefined) {
      byWinnerGroup[winnerGroup as GroupLetter] = { group: thirdGroup as GroupLetter, teamId };
    }
  }
  return { combo, byWinnerGroup };
}
