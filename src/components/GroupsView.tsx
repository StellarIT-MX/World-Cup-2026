import type { Fixture, GroupLetter, MatchResult, StandingRow, Team } from '../domain/types';
import { GROUPS, groupComplete } from '../domain/standings';
import type { UseTournament } from '../hooks/useTournament';
import { Flag } from './Flag';

function MatchRow({
  fixture, result, teamById, simEnabled, setOverride,
}: {
  fixture: Fixture;
  result: MatchResult | undefined;
  teamById: Map<number, Team>;
  simEnabled: boolean;
  setOverride: (id: number, r: MatchResult | null) => void;
}) {
  if (fixture.home.kind !== 'team' || fixture.away.kind !== 'team') return null;
  const home = teamById.get(fixture.home.teamId);
  const away = teamById.get(fixture.away.teamId);
  const played = result?.finished;
  const time = fixture.date ? fixture.date.slice(5, 16).replace('T', ' ') : '';

  const onChange = (side: 'h' | 'a', raw: string) => {
    const value = raw.replace(/\D/g, '');
    const hRaw = side === 'h' ? value : (result?.homeGoals != null ? String(result.homeGoals) : '');
    const aRaw = side === 'a' ? value : (result?.awayGoals != null ? String(result.awayGoals) : '');
    if (hRaw === '' && aRaw === '') { setOverride(fixture.id, null); return; }
    setOverride(fixture.id, {
      homeGoals: hRaw === '' ? 0 : Number(hRaw),
      awayGoals: aRaw === '' ? 0 : Number(aRaw),
      finished: true,
    });
  };

  return (
    <li className={`match-row ${played ? '' : 'match-row--pending'}`}>
      <span className="mr-team mr-home">
        <span className="mr-name">{home?.name ?? '?'}</span>
        <Flag team={home} />
      </span>
      {simEnabled ? (
        <span className="mr-score mr-score--edit">
          <input type="text" inputMode="numeric" pattern="[0-9]*"
            value={result?.homeGoals != null ? result.homeGoals : ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange('h', e.target.value)} />
          <span>-</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*"
            value={result?.awayGoals != null ? result.awayGoals : ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange('a', e.target.value)} />
        </span>
      ) : (
        <span className="mr-score">
          {played ? `${result!.homeGoals} - ${result!.awayGoals}` : <span className="mr-time">{time}</span>}
        </span>
      )}
      <span className="mr-team mr-away">
        <Flag team={away} />
        <span className="mr-name">{away?.name ?? '?'}</span>
      </span>
    </li>
  );
}

function GroupCard({ group, rows, t }: { group: GroupLetter; rows: StandingRow[]; t: UseTournament }) {
  const { data, results, teamById, simEnabled, setOverride } = t;
  const complete = data ? groupComplete(data.fixtures, results, group) : false;
  const matches = (data?.fixtures ?? [])
    .filter((f) => f.stage === 'group' && f.group === group)
    .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0) || a.id - b.id);

  return (
    <div className="card group-card">
      <div className="group-head">
        <h3>Grupo {group}</h3>
        {complete ? <span className="badge badge--done">Completo</span>
          : <span className="badge">En curso</span>}
      </div>
      <table className="standings">
        <thead>
          <tr><th></th><th className="ta-l">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const team = teamById.get(r.teamId);
            const cls = r.rank <= 2 ? 'pos--qualify' : r.rank === 3 ? 'pos--third' : '';
            return (
              <tr key={r.teamId} className={cls}>
                <td className="pos">{r.rank}</td>
                <td className="ta-l team-cell"><Flag team={team} /> <span>{team?.name}</span></td>
                <td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td>
                <td>{r.gf}</td><td>{r.ga}</td><td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="pts">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="match-list">
        {matches.map((f) => (
          <MatchRow key={f.id} fixture={f} result={results[String(f.id)]}
            teamById={teamById} simEnabled={simEnabled} setOverride={setOverride} />
        ))}
      </ul>
    </div>
  );
}

export function GroupsView({ t }: { t: UseTournament }) {
  if (!t.state) return null;
  return (
    <>
      <div className="legend">
        <span className="chip chip--qualify">1.º y 2.º: clasifican</span>
        <span className="chip chip--third">3.º: posible mejor tercero</span>
      </div>
      <div className="groups-grid">
        {GROUPS.map((g) => (
          <GroupCard key={g} group={g} rows={t.state!.standings[g]} t={t} />
        ))}
      </div>
    </>
  );
}
