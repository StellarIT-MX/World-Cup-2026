import { useState } from 'react';
import './App.css';
import { useTournament } from './hooks/useTournament';
import { GroupsView } from './components/GroupsView';
import { ThirdPlaceView } from './components/ThirdPlaceView';
import { BracketView } from './components/BracketView';

type Tab = 'groups' | 'thirds' | 'bracket';

const TABS: { id: Tab; label: string }[] = [
  { id: 'groups', label: 'Grupos' },
  { id: 'thirds', label: 'Terceros' },
  { id: 'bracket', label: 'Bracket' },
];

export default function App() {
  const t = useTournament();
  const [tab, setTab] = useState<Tab>('groups');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⚽</span>
          <div>
            <h1>Mundial 2026 <span className="brand-sub">· Resultados y llaves</span></h1>
            <p className="brand-tag">USA · Canadá · México — 48 equipos · 104 partidos</p>
          </div>
        </div>
        <div className="sim-controls">
          {t.simEnabled && t.simCount > 0 && (
            <button className="btn btn--ghost" onClick={t.resetSim}>Reiniciar ({t.simCount})</button>
          )}
          <button
            className={`btn ${t.simEnabled ? 'btn--on' : ''}`}
            onClick={() => t.setSimEnabled(!t.simEnabled)}
          >
            {t.simEnabled ? '● Simulador activo' : '○ Simulador'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((x) => (
          <button key={x.id} className={`tab ${tab === x.id ? 'tab--active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {t.loading && <p className="status">Cargando datos del torneo…</p>}
        {t.error && <p className="status status--error">Error: {t.error}</p>}
        {!t.loading && !t.error && t.state && (
          <>
            {tab === 'groups' && <GroupsView t={t} />}
            {tab === 'thirds' && <ThirdPlaceView t={t} />}
            {tab === 'bracket' && <BracketView t={t} />}
          </>
        )}
      </main>

      <footer className="footer">
        <span>Desempates y Anexo C según el reglamento oficial FIFA World Cup 2026™.</span>
        {t.simEnabled && <span className="footer-sim"> · Estás viendo una simulación, no resultados reales.</span>}
      </footer>
    </div>
  );
}
