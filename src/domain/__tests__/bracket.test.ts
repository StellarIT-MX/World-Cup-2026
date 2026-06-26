import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AnnexeC, Fixture, ResultsMap, Team } from '../types';
import { resolveThirdAllocation, type ThirdPlaceRow } from '../thirdPlace';
import { computeTournament } from '../engine';

const dataDir = resolve(process.cwd(), 'public/data');
const read = (f: string) => JSON.parse(readFileSync(resolve(dataDir, f), 'utf8'));

const teams: Team[] = read('teams.json');
const fixtures: Fixture[] = read('fixtures.json');
const results: ResultsMap = read('results.json');
const annexe: AnnexeC = read('annexe-c.json');

describe('Anexo C (datos oficiales)', () => {
  it('contiene las 495 combinaciones', () => {
    expect(Object.keys(annexe).length).toBe(495);
  });

  it('ejemplo oficial FIFA: terceros de {A..H} -> USA (1.º D) enfrenta al 3.º del grupo B', () => {
    expect(annexe['ABCDEFGH'].D).toBe('B');
  });

  it('cada combinacion respeta los allowed-sets de cada slot', () => {
    const allowed: Record<string, string> = {
      A: 'CEFHI', B: 'EFGIJ', D: 'BEFIJ', E: 'ABCDF', G: 'AEHIJ', I: 'CDFGH', K: 'DEIJL', L: 'EHIJK',
    };
    for (const [combo, map] of Object.entries(annexe)) {
      for (const [winner, third] of Object.entries(map)) {
        expect(allowed[winner].includes(third)).toBe(true);
      }
      // la combinacion usa exactamente los 8 grupos de la clave
      expect(Object.values(map).slice().sort().join('')).toBe(combo);
    }
  });
});

describe('resolveThirdAllocation', () => {
  it('mapea la combinacion {A..H} a equipos via el Anexo C', () => {
    // tercero de cada grupo: teamId ficticio = posicion del grupo (A=1..H=8)
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
    const thirds: ThirdPlaceRow[] = groups.map((g, i) => ({
      group: g, teamId: i + 1, played: 3, points: 3, gd: 0, gf: 1, fairPlay: 0,
      thirdRank: i + 1, qualifies: true,
    }));
    const alloc = resolveThirdAllocation(thirds, annexe);
    expect(alloc).not.toBeNull();
    expect(alloc!.combo).toBe('ABCDEFGH');
    // D -> tercero del grupo B -> teamId 2
    expect(alloc!.byWinnerGroup.D).toEqual({ group: 'B', teamId: 2 });
  });

  it('devuelve null si no hay 8 terceros confirmados', () => {
    expect(resolveThirdAllocation([], annexe)).toBeNull();
  });
});

describe('computeTournament con datos reales', () => {
  const state = computeTournament({ teams, fixtures, results, stadiums: read('stadiums.json'), annexe }, results);

  it('cada grupo tiene 4 equipos con rank 1..4', () => {
    for (const g of Object.keys(state.standings)) {
      const rows = state.standings[g as keyof typeof state.standings];
      expect(rows).toHaveLength(4);
      expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    }
  });

  it('los puntos de un grupo cuadran con 3 pts por victoria', () => {
    // suma de puntos del grupo = 3*partidos_no_empatados + 2*empates
    for (const g of Object.keys(state.standings)) {
      const rows = state.standings[g as keyof typeof state.standings];
      const totalPts = rows.reduce((s, r) => s + r.points, 0);
      const totalPlayed = rows.reduce((s, r) => s + r.played, 0) / 2; // cada partido cuenta 2 veces
      // cada partido reparte 2 o 3 puntos
      expect(totalPts).toBeGreaterThanOrEqual(totalPlayed * 2);
      expect(totalPts).toBeLessThanOrEqual(totalPlayed * 3);
    }
  });

  it('el bracket tiene 32 partidos de eliminatoria', () => {
    expect(state.bracket).toHaveLength(32);
    expect(state.bracket.filter((m) => m.stage === 'r32')).toHaveLength(16);
    expect(state.bracket.filter((m) => m.stage === 'final')).toHaveLength(1);
  });

  it('un grupo completo resuelve su ganador y subcampeon en el bracket', () => {
    // localizar un R32 que use 1.º/2.º de un grupo ya completo
    const resolvedSlots = state.bracket
      .filter((m) => m.stage === 'r32')
      .flatMap((m) => [m.home, m.away])
      .filter((s) => (s.ref.kind === 'winner-group' || s.ref.kind === 'runner-group') && s.teamId != null);
    // con datos reales (fase de grupos avanzada) deberia haber al menos un grupo resuelto
    expect(resolvedSlots.length).toBeGreaterThan(0);
  });
});
