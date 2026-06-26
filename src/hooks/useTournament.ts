import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnnexeC, Fixture, MatchResult, ResultsMap, Stadium, Team, TournamentData } from '../domain/types';
import { computeTournament, mergeResults, type TournamentState } from '../domain/engine';
import { groupComplete, GROUPS } from '../domain/standings';

const BASE = import.meta.env.BASE_URL;

async function loadJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}data/${file}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`No se pudo cargar ${file} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

export interface UseTournament {
  loading: boolean;
  error: string | null;
  data: TournamentData | null;
  state: TournamentState | null;
  results: ResultsMap;
  teamById: Map<number, Team>;
  stadiumById: Map<number, Stadium>;
  allGroupsComplete: boolean;
  /** Simulador */
  simEnabled: boolean;
  setSimEnabled: (v: boolean) => void;
  overrides: ResultsMap;
  setOverride: (matchId: number, result: MatchResult | null) => void;
  resetSim: () => void;
  simCount: number;
}

export function useTournament(): UseTournament {
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [simEnabled, setSimEnabled] = useState(false);
  const [overrides, setOverrides] = useState<ResultsMap>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [teams, stadiums, fixtures, results, annexe] = await Promise.all([
          loadJson<Team[]>('teams.json'),
          loadJson<Stadium[]>('stadiums.json'),
          loadJson<Fixture[]>('fixtures.json'),
          loadJson<ResultsMap>('results.json'),
          loadJson<AnnexeC>('annexe-c.json'),
        ]);
        if (alive) setData({ teams, stadiums, fixtures, results, annexe });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const setOverride = useCallback((matchId: number, result: MatchResult | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (result === null) delete next[String(matchId)];
      else next[String(matchId)] = result;
      return next;
    });
  }, []);

  const resetSim = useCallback(() => setOverrides({}), []);

  const effectiveResults = useMemo(() => {
    if (!data) return {};
    return simEnabled ? mergeResults(data.results, overrides) : data.results;
  }, [data, simEnabled, overrides]);

  const state = useMemo(() => {
    if (!data) return null;
    return computeTournament(data, effectiveResults);
  }, [data, effectiveResults]);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((t) => [t.id, t])), [data]);
  const stadiumById = useMemo(() => new Map((data?.stadiums ?? []).map((s) => [s.id, s])), [data]);

  const allGroupsComplete = useMemo(() => {
    if (!data) return false;
    return GROUPS.every((g) => groupComplete(data.fixtures, effectiveResults, g));
  }, [data, effectiveResults]);

  return {
    loading, error, data, state, results: effectiveResults, teamById, stadiumById, allGroupsComplete,
    simEnabled, setSimEnabled, overrides, setOverride, resetSim,
    simCount: Object.keys(overrides).length,
  };
}
