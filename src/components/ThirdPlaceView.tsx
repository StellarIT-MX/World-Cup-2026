import type { GroupLetter } from '../domain/types';
import type { UseTournament } from '../hooks/useTournament';
import { Flag } from './Flag';
import { formatMatchTime } from '../utils/dateUtils';

export function ThirdPlaceView({ t }: { t: UseTournament }) {
  if (!t.state) return null;
  const { thirds, allocation } = t.state;
  const { teamById, allGroupsComplete } = t;

  // Mapa de grupo ganador → fixture r32 correspondiente
  const r32ByWinner = new Map<string, { date: string | null; stadiumId: number }>();
  for (const f of t.data?.fixtures ?? []) {
    if (f.stage !== 'r32') continue;
    if (f.home.kind === 'winner-group') r32ByWinner.set(f.home.group, f);
    if (f.away.kind === 'winner-group') r32ByWinner.set(f.away.group, f);
  }

  return (
    <div className="thirds-wrap">
      <div className="card">
        <div className="group-head">
          <h3>Mejores terceros</h3>
          {allGroupsComplete
            ? <span className="badge badge--done">Definitivo</span>
            : <span className="badge badge--warn">Provisional</span>}
        </div>
        {!allGroupsComplete && (
          <p className="note">
            Aún faltan grupos por terminar. Este ranking y la clasificación de los 8 mejores
            terceros pueden cambiar. FIFA confirma los terceros definitivos al cerrar la fase de grupos.
          </p>
        )}
        <table className="standings thirds-table">
          <thead>
            <tr><th></th><th>Gr.</th><th className="ta-l">Equipo</th><th>PJ</th><th>GF</th><th>DG</th><th>Pts</th><th></th></tr>
          </thead>
          <tbody>
            {thirds.map((r) => {
              const team = teamById.get(r.teamId);
              return (
                <tr key={r.teamId} className={r.qualifies ? 'pos--qualify' : 'pos--out'}>
                  <td className="pos">{r.thirdRank}</td>
                  <td className="grp">{r.group}</td>
                  <td className="ta-l team-cell"><Flag team={team} /> <span>{team?.name}</span></td>
                  <td>{r.played}</td><td>{r.gf}</td>
                  <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="pts">{r.points}</td>
                  <td>{r.qualifies ? '✅' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="group-head"><h3>Asignación a 16avos (Anexo C FIFA)</h3></div>
        {allocation ? (
          <>
            <p className="note">
              Combinación de terceros clasificados: <strong>{allocation.combo.split('').join(' · ')}</strong>.
              Según el Anexo C del reglamento, cada tercero enfrenta a:
            </p>
            <table className="standings alloc-table">
              <thead>
                <tr>
                  <th>Ganador de grupo</th>
                  <th>enfrenta al 3.º de</th>
                  <th>= equipo</th>
                  <th>Fecha (GDL)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allocation.byWinnerGroup)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([winner, info]) => {
                    const fixture = r32ByWinner.get(winner);
                    const dateStr = fixture?.date
                      ? formatMatchTime(fixture.date, fixture.stadiumId)
                      : '—';
                    const winnerRow = t.state?.standings[winner as GroupLetter]?.find((r) => r.rank === 1);
                    const winnerTeam = winnerRow ? teamById.get(winnerRow.teamId) : undefined;
                    return (
                      <tr key={winner}>
                        <td className="pts team-cell">
                          <Flag team={winnerTeam} /><span>1.º {winner}</span>
                        </td>
                        <td>Grupo {info!.group}</td>
                        <td className="ta-l team-cell">
                          <Flag team={teamById.get(info!.teamId)} /> <span>{teamById.get(info!.teamId)?.name}</span>
                        </td>
                        <td className="match-time">{dateStr}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        ) : (
          <p className="note">Aún no se conocen los 8 terceros clasificados. Se mostrará al avanzar la fase de grupos.</p>
        )}
      </div>
    </div>
  );
}
