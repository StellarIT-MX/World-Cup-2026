import type { BracketMatch, SlotState } from '../domain/bracket';
import { STAGE_LABEL } from '../domain/bracket';
import type { Stage, Team } from '../domain/types';
import type { UseTournament } from '../hooks/useTournament';
import { Flag } from './Flag';
import { formatMatchTime } from '../utils/dateUtils';

const COLUMN_STAGES: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

function Slot({
  slot, isWinner, isLoser, goals, pens, canPick, onPick,
}: {
  slot: SlotState;
  isWinner: boolean;
  isLoser: boolean;
  goals: number | null;
  pens: number | null;
  canPick: boolean;
  onPick: () => void;
}) {
  const cls = `ko-slot${isWinner ? ' is-winner' : ''}${isLoser ? ' is-loser' : ''}${slot.team ? '' : ' is-empty'}${canPick ? ' is-pickable' : ''}`;
  return (
    <div className={cls} onClick={canPick ? onPick : undefined} role={canPick ? 'button' : undefined}>
      <Flag team={slot.team} size={18} />
      <span className="ko-name" title={slot.label}>{slot.team ? slot.team.name : slot.label}</span>
      {goals != null && (
        <span className="ko-goals">{goals}{pens != null ? <sup>({pens})</sup> : null}</span>
      )}
    </div>
  );
}

function MatchCard({ m, t }: { m: BracketMatch; t: UseTournament }) {
  const { simEnabled, setOverride } = t;
  const r = m.result;
  const decided = m.winnerTeamId != null;
  const bothResolved = m.home.teamId != null && m.away.teamId != null;
  const canPick = simEnabled && bothResolved;

  const pick = (side: 'home' | 'away') => {
    const teamId = side === 'home' ? m.home.teamId : m.away.teamId;
    if (decided && m.winnerTeamId === teamId) { setOverride(m.id, null); return; } // toggle off
    setOverride(m.id, side === 'home'
      ? { homeGoals: 1, awayGoals: 0, finished: true }
      : { homeGoals: 0, awayGoals: 1, finished: true });
  };

  const homePens = r?.homePens != null && r?.awayPens != null ? r.homePens : null;
  const awayPens = r?.homePens != null && r?.awayPens != null ? r.awayPens : null;

  const matchTime = m.date ? formatMatchTime(m.date, m.stadiumId) : null;

  return (
    <div className={`ko-match${decided ? ' is-decided' : ''}`}>
      <div className="ko-id">M{m.id}{matchTime && <span className="ko-date">{matchTime}</span>}</div>
      <Slot slot={m.home} isWinner={m.winnerTeamId === m.home.teamId && decided}
        isLoser={decided && m.loserTeamId === m.home.teamId}
        goals={r?.finished ? r.homeGoals : null} pens={homePens}
        canPick={canPick} onPick={() => pick('home')} />
      <Slot slot={m.away} isWinner={m.winnerTeamId === m.away.teamId && decided}
        isLoser={decided && m.loserTeamId === m.away.teamId}
        goals={r?.finished ? r.awayGoals : null} pens={awayPens}
        canPick={canPick} onPick={() => pick('away')} />
    </div>
  );
}

function PodiumBanner({ bracket, teamById }: { bracket: BracketMatch[]; teamById: Map<number, Team> }) {
  const final = bracket.find((m) => m.stage === 'final');
  if (!final?.winnerTeamId) return null;

  const champion = teamById.get(final.winnerTeamId) ?? null;
  const runnerUp = final.loserTeamId != null ? (teamById.get(final.loserTeamId) ?? null) : null;
  const thirdMatch = bracket.find((m) => m.stage === 'third');
  const third = thirdMatch?.winnerTeamId != null ? (teamById.get(thirdMatch.winnerTeamId) ?? null) : null;

  return (
    <div className="podium-banner">
      <div className="podium-champion">
        <span className="podium-trophy">🏆</span>
        <Flag team={champion} size={60} />
        <span className="podium-champion-name">{champion?.name}</span>
        <span className="podium-champion-title">¡Campeón del Mundo FIFA 2026!</span>
      </div>
      {(runnerUp || third) && (
        <div className="podium-others">
          {runnerUp && (
            <div className="podium-slot">
              <span className="podium-medal">🥈</span>
              <Flag team={runnerUp} size={30} />
              <span className="podium-slot-name">{runnerUp.name}</span>
            </div>
          )}
          {third && (
            <div className="podium-slot">
              <span className="podium-medal">🥉</span>
              <Flag team={third} size={30} />
              <span className="podium-slot-name">{third.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BracketView({ t }: { t: UseTournament }) {
  if (!t.state) return null;
  const bracket = t.state.bracket;
  const byStage = (s: Stage) => bracket.filter((m) => m.stage === s);
  const third = byStage('third')[0];

  return (
    <>
      {t.simEnabled && (
        <p className="note note--sim">
          Modo simulador: haz clic en un equipo de cada cruce para marcarlo como ganador y ver cómo avanza el cuadro.
        </p>
      )}
      <div className="bracket-scroll">
        <div className="bracket">
          {COLUMN_STAGES.map((stage) => (
            <div key={stage} className={`bracket-col col--${stage}`}>
              <h4 className="col-title">{STAGE_LABEL[stage]}</h4>
              {stage === 'final' && <PodiumBanner bracket={bracket} teamById={t.teamById} />}
              {byStage(stage).map((m) => <MatchCard key={m.id} m={m} t={t} />)}
              {stage === 'final' && third && (
                <>
                  <h4 className="col-title col-title--third">{STAGE_LABEL.third}</h4>
                  <MatchCard m={third} t={t} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
