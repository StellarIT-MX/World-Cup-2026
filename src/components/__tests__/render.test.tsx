import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AnnexeC, Fixture, ResultsMap, Stadium, Team, TournamentData } from '../../domain/types';
import { computeTournament } from '../../domain/engine';
import type { UseTournament } from '../../hooks/useTournament';
import { GroupsView } from '../GroupsView';
import { ThirdPlaceView } from '../ThirdPlaceView';
import { BracketView } from '../BracketView';

const d = resolve(process.cwd(), 'public/data');
const read = (f: string) => JSON.parse(readFileSync(resolve(d, f), 'utf8'));

const data: TournamentData = {
  teams: read('teams.json') as Team[],
  stadiums: read('stadiums.json') as Stadium[],
  fixtures: read('fixtures.json') as Fixture[],
  results: read('results.json') as ResultsMap,
  annexe: read('annexe-c.json') as AnnexeC,
};

function harness(simEnabled = false): UseTournament {
  const state = computeTournament(data, data.results);
  return {
    loading: false, error: null, data, state, results: data.results,
    teamById: new Map(data.teams.map((t) => [t.id, t])),
    stadiumById: new Map(data.stadiums.map((s) => [s.id, s])),
    allGroupsComplete: false,
    simEnabled, setSimEnabled: () => {}, overrides: {}, setOverride: () => {},
    resetSim: () => {}, simCount: 0,
  };
}

describe('render smoke (datos reales, sin DOM)', () => {
  it('GroupsView renderiza las 12 tablas', () => {
    const html = renderToString(<GroupsView t={harness()} />);
    expect((html.match(/group-card/g) || []).length).toBe(12);
    expect(html).toContain('Mexico');
    expect(html).toContain('Argentina');
  });

  it('GroupsView en modo simulador renderiza inputs editables', () => {
    const html = renderToString(<GroupsView t={harness(true)} />);
    expect(html).toContain('input');
  });

  it('ThirdPlaceView renderiza ranking y asignación', () => {
    const html = renderToString(<ThirdPlaceView t={harness()} />);
    expect(html).toContain('Mejores terceros');
  });

  it('BracketView renderiza todas las rondas', () => {
    const html = renderToString(<BracketView t={harness()} />);
    expect(html).toContain('Dieciseisavos');
    expect(html).toContain('Final');
    expect(html).toContain('Tercer lugar');
  });
});
