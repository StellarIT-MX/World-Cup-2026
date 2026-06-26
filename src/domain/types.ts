// Tipos del dominio del torneo. Todo el calculo de standings/bracket opera sobre estos.

export type GroupLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

export interface Team {
  id: number;
  name: string;
  code: string;
  iso2: string;
  flag: string;
  group: GroupLetter;
  fifaRank: number;
}

export interface Stadium {
  id: number;
  name: string;
  venue: string;
  city: string;
  country: string;
  capacity: number;
}

/** Referencia a un equipo dentro de un fixture: directo o derivado del bracket. */
export type TeamRef =
  | { kind: 'team'; teamId: number }
  | { kind: 'winner-group'; group: GroupLetter }
  | { kind: 'runner-group'; group: GroupLetter }
  | { kind: 'third'; winnerGroup: GroupLetter; groups: GroupLetter[] }
  | { kind: 'match-winner'; match: number }
  | { kind: 'match-loser'; match: number };

export interface Fixture {
  id: number;
  stage: Stage;
  group: GroupLetter | null;
  matchday: number | null;
  date: string | null;
  stadiumId: number;
  home: TeamRef;
  away: TeamRef;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  finished: boolean;
  /** Penales (solo eliminatoria con empate en tiempo reglamentario). */
  homePens?: number;
  awayPens?: number;
  /** Puntos de fair-play (tarjetas). Negativo = peor. Opcional. */
  homeFairPlay?: number;
  awayFairPlay?: number;
}

export type ResultsMap = Record<string, MatchResult>;

/** Anexo C: combinacion de 8 grupos (ordenada, p.ej. "ABCDEFGH") -> { grupoGanador: grupoTercero }. */
export type AnnexeC = Record<string, Record<string, GroupLetter>>;

export interface TournamentData {
  teams: Team[];
  stadiums: Stadium[];
  fixtures: Fixture[];
  results: ResultsMap;
  annexe: AnnexeC;
}

/** Estadisticas acumuladas de un equipo (en un grupo o en un sub-conjunto de partidos). */
export interface TeamStats {
  teamId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  fairPlay: number;
}

export interface StandingRow extends TeamStats {
  rank: number; // 1..4 dentro del grupo
}
