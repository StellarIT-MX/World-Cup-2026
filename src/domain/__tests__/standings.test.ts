import { describe, it, expect } from 'vitest';
import type { Fixture, GroupLetter, ResultsMap, Team } from '../types';
import { computeGroupStandings } from '../standings';

// --- helpers para construir un grupo sintetico ---
function team(id: number, group: GroupLetter, fifaRank = id): Team {
  return { id, name: `T${id}`, code: `T${id}`, iso2: 'xx', flag: '', group, fifaRank };
}

// Las 6 combinaciones de un grupo de 4. id de partido = indice+1.
const PAIRS: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

function groupFixtures(group: GroupLetter, ids: number[]): Fixture[] {
  return PAIRS.map(([h, a], i) => ({
    id: i + 1,
    stage: 'group',
    group,
    matchday: 1,
    date: null,
    stadiumId: 1,
    home: { kind: 'team', teamId: ids[h] },
    away: { kind: 'team', teamId: ids[a] },
  }));
}

/** score helper por par de equipos (homeId-awayId del PAIRS correspondiente). */
function results(scores: Record<number, [number, number]>): ResultsMap {
  const out: ResultsMap = {};
  for (const [id, [h, a]] of Object.entries(scores)) {
    out[id] = { homeGoals: h, awayGoals: a, finished: true };
  }
  return out;
}

describe('computeGroupStandings (desempates FIFA 2026)', () => {
  const ids = [1, 2, 3, 4];
  const teams = ids.map((i) => team(i, 'A'));
  const fixtures = groupFixtures('A', ids);
  // PAIRS -> matchId: 1=(1v2) 2=(1v3) 3=(1v4) 4=(2v3) 5=(2v4) 6=(3v4)

  it('ordena por puntos cuando no hay empates', () => {
    // t1 gana todo, t2 gana 2, t3 gana 1, t4 nada
    const r = results({
      1: [1, 0], // t1>t2
      2: [1, 0], // t1>t3
      3: [1, 0], // t1>t4
      4: [1, 0], // t2>t3
      5: [1, 0], // t2>t4
      6: [1, 0], // t3>t4
    });
    const s = computeGroupStandings(teams, fixtures, r, 'A');
    expect(s.map((x) => x.teamId)).toEqual([1, 2, 3, 4]);
    expect(s[0].points).toBe(9);
    expect(s[3].points).toBe(0);
  });

  it('head-to-head ANTES que diferencia de gol global (cambio clave 2026)', () => {
    // t1 y t2 empatan a 6 pts. t2 tiene MUCHO mejor GD global, pero t1 le gano en h2h.
    const r = results({
      1: [1, 0], // t1>t2  (h2h decisivo a favor de t1)
      2: [0, 3], // t1<t3
      3: [1, 0], // t1>t4   -> t1: 6 pts, gd -1
      4: [5, 0], // t2>t3
      5: [1, 0], // t2>t4   -> t2: 6 pts, gd +5
      6: [0, 1], // t3<t4
    });
    const s = computeGroupStandings(teams, fixtures, r, 'A');
    // t1 primero pese a peor GD global, por ganar el head-to-head
    expect(s[0].teamId).toBe(1);
    expect(s[1].teamId).toBe(2);
    expect(s[0].gd).toBeLessThan(s[1].gd); // confirma que ganó con peor GD global
  });

  it('triple empate: si el head-to-head no separa, cae a GD global', () => {
    // t1>t2, t2>t3, t3>t1 (ciclo, todos 1-0) y los tres ganan a t4 con distinto margen.
    const r = results({
      1: [1, 0], // t1>t2
      2: [0, 1], // t1<t3
      3: [3, 0], // t1>t4 (gd +3 contribucion)
      4: [1, 0], // t2>t3
      5: [1, 0], // t2>t4
      6: [2, 0], // t3>t4
    });
    const s = computeGroupStandings(teams, fixtures, r, 'A');
    // t1,t2,t3 todos 6 pts; h2h entre ellos: 3 pts/gd0/gf1 cada uno -> empate -> GD global
    // GD global: t1=+3-... t1: gf 1+0+3=4 ga 0+1+0=1 -> +3 ; t3: gf 0+1+2=3 ga1 -> +2 ; t2: gf1+1+1=3?
    // t2: 1(vs t1)+1(vs t3)? no: t2 jugó t1(0-1),t3(1-0),t4(1-0) gf=2 ga=1 +1
    expect(s.map((x) => x.teamId)).toEqual([1, 3, 2, 4]);
    expect(s[0].points).toBe(6);
    expect(s[2].points).toBe(6);
  });
});
