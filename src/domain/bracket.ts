// Construye el bracket de eliminatoria resolviendo cada slot (1A, 2B, 3°, Ganador M73...)
// a un equipo concreto conforme entran los resultados.

import type {
  Fixture, GroupLetter, MatchResult, ResultsMap, Stage, StandingRow, Team, TeamRef,
} from './types';
import { groupComplete } from './standings';
import type { ThirdAllocation } from './thirdPlace';

export interface SlotState {
  ref: TeamRef;
  teamId: number | null;
  /** Texto a mostrar: nombre del equipo si esta resuelto, si no un placeholder. */
  label: string;
  team: Team | null;
}

export interface BracketMatch {
  id: number;
  stage: Stage;
  date: string | null;
  stadiumId: number;
  home: SlotState;
  away: SlotState;
  result: MatchResult | null;
  /** Equipo ganador (decidido), o null si no jugado/indeciso. */
  winnerTeamId: number | null;
  loserTeamId: number | null;
}

export const KO_STAGES: Stage[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
export const STAGE_LABEL: Record<Stage, string> = {
  group: 'Fase de grupos',
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  third: 'Tercer lugar',
  final: 'Final',
};

interface Ctx {
  fixtureById: Map<number, Fixture>;
  results: ResultsMap;
  teamById: Map<number, Team>;
  standings: Record<GroupLetter, StandingRow[]>;
  completeGroup: (g: GroupLetter) => boolean;
  allocation: ThirdAllocation | null;
  outcomeMemo: Map<number, Outcome | null>;
}

interface Outcome {
  winner: number;
  loser: number;
}

function placeholder(ref: TeamRef): string {
  switch (ref.kind) {
    case 'team': return 'Equipo';
    case 'winner-group': return `1.º Grupo ${ref.group}`;
    case 'runner-group': return `2.º Grupo ${ref.group}`;
    case 'third': return `3.º (${ref.groups.join('/')})`;
    case 'match-winner': return `Ganador M${ref.match}`;
    case 'match-loser': return `Perdedor M${ref.match}`;
  }
}

function resolveRef(ref: TeamRef, ctx: Ctx): number | null {
  switch (ref.kind) {
    case 'team':
      return ref.teamId;
    case 'winner-group':
      return ctx.completeGroup(ref.group) ? ctx.standings[ref.group][0]?.teamId ?? null : null;
    case 'runner-group':
      return ctx.completeGroup(ref.group) ? ctx.standings[ref.group][1]?.teamId ?? null : null;
    case 'third':
      return ctx.allocation?.byWinnerGroup[ref.winnerGroup]?.teamId ?? null;
    case 'match-winner':
      return matchOutcome(ref.match, ctx)?.winner ?? null;
    case 'match-loser':
      return matchOutcome(ref.match, ctx)?.loser ?? null;
  }
}

function matchOutcome(matchId: number, ctx: Ctx): Outcome | null {
  if (ctx.outcomeMemo.has(matchId)) return ctx.outcomeMemo.get(matchId)!;
  ctx.outcomeMemo.set(matchId, null); // corta ciclos (no deberian existir)

  const f = ctx.fixtureById.get(matchId);
  const r = ctx.results[String(matchId)];
  let result: Outcome | null = null;
  if (f && r && r.finished) {
    const homeId = resolveRef(f.home, ctx);
    const awayId = resolveRef(f.away, ctx);
    if (homeId != null && awayId != null) {
      if (r.homeGoals > r.awayGoals) result = { winner: homeId, loser: awayId };
      else if (r.homeGoals < r.awayGoals) result = { winner: awayId, loser: homeId };
      else {
        const hp = r.homePens ?? 0, ap = r.awayPens ?? 0;
        if (hp !== ap) {
          result = hp > ap ? { winner: homeId, loser: awayId } : { winner: awayId, loser: homeId };
        }
      }
    }
  }
  ctx.outcomeMemo.set(matchId, result);
  return result;
}

function slot(ref: TeamRef, ctx: Ctx): SlotState {
  const teamId = resolveRef(ref, ctx);
  const team = teamId != null ? ctx.teamById.get(teamId) ?? null : null;
  return { ref, teamId, team, label: team ? team.name : placeholder(ref) };
}

/** Construye todos los partidos de eliminatoria resueltos al estado actual. */
export function buildBracket(
  teams: Team[],
  fixtures: Fixture[],
  results: ResultsMap,
  standings: Record<GroupLetter, StandingRow[]>,
  allocation: ThirdAllocation | null,
): BracketMatch[] {
  const ctx: Ctx = {
    fixtureById: new Map(fixtures.map((f) => [f.id, f])),
    results,
    teamById: new Map(teams.map((t) => [t.id, t])),
    standings,
    completeGroup: (g) => groupComplete(fixtures, results, g),
    allocation,
    outcomeMemo: new Map(),
  };

  return fixtures
    .filter((f) => f.stage !== 'group')
    .sort((a, b) => a.id - b.id)
    .map((f) => {
      const outcome = matchOutcome(f.id, ctx);
      const r = ctx.results[String(f.id)] ?? null;
      return {
        id: f.id,
        stage: f.stage,
        date: f.date,
        stadiumId: f.stadiumId,
        home: slot(f.home, ctx),
        away: slot(f.away, ctx),
        result: r,
        winnerTeamId: outcome?.winner ?? null,
        loserTeamId: outcome?.loser ?? null,
      };
    });
}
