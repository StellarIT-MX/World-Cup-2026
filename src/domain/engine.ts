// Compone el estado completo del torneo a partir de los datos + un mapa de resultados.
// Funcion pura: misma entrada -> misma salida. El simulador solo cambia el mapa de resultados.

import type { GroupLetter, ResultsMap, StandingRow, TournamentData } from './types';
import { computeAllStandings } from './standings';
import { rankThirdPlaced, resolveThirdAllocation, type ThirdAllocation, type ThirdPlaceRow } from './thirdPlace';
import { buildBracket, type BracketMatch } from './bracket';

export interface TournamentState {
  standings: Record<GroupLetter, StandingRow[]>;
  thirds: ThirdPlaceRow[];
  allocation: ThirdAllocation | null;
  bracket: BracketMatch[];
}

export function computeTournament(data: TournamentData, results: ResultsMap): TournamentState {
  const standings = computeAllStandings(data.teams, data.fixtures, results);
  const thirds = rankThirdPlaced(standings, data.teams);
  const allocation = resolveThirdAllocation(thirds, data.annexe);
  const bracket = buildBracket(data.teams, data.fixtures, results, standings, allocation);
  return { standings, thirds, allocation, bracket };
}

/** Combina los resultados reales con los hipoteticos del simulador (estos ganan). */
export function mergeResults(base: ResultsMap, overrides: ResultsMap): ResultsMap {
  return { ...base, ...overrides };
}
