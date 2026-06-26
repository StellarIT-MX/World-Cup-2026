#!/usr/bin/env node
// Genera/actualiza los datos del proyecto desde la API pública gratuita worldcup26.ir.
//
// Uso:
//   node scripts/fetch-data.mjs            -> actualiza SOLO results.json (uso periodico)
//   node scripts/fetch-data.mjs --all      -> regenera teams/stadiums/fixtures/results
//   node scripts/fetch-data.mjs --offline  -> usa scripts/.cache/raw_*.json (sin red)
//
// results.json es la FUENTE DE LA VERDAD editable a mano: este script lo PRE-LLENA,
// pero puedes corregir cualquier marcador manualmente. annexe-c.json NO se toca aqui
// (se genera con scripts/extract-annexe.mjs a partir del reglamento oficial FIFA).

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'public', 'data');
const CACHE = join(__dirname, '.cache');
const API = 'https://worldcup26.ir';

const argv = process.argv.slice(2);
const REGEN_ALL = argv.includes('--all');
const OFFLINE = argv.includes('--offline');

// ---------- Estructura fija y verificada del bracket (FIFA WC2026, art. 12 + Anexo C) ----------
// Cada slot de tercero se resuelve via annexe-c.json usando el grupo del GANADOR (winnerGroup).
const t = (winnerGroup, groups) => ({ kind: 'third', winnerGroup, groups: groups.split('') });
const w = (group) => ({ kind: 'winner-group', group });
const r = (group) => ({ kind: 'runner-group', group });
const mw = (match) => ({ kind: 'match-winner', match });
const ml = (match) => ({ kind: 'match-loser', match });

const KNOCKOUT = {
  73: { stage: 'r32', home: r('A'), away: r('B') },
  74: { stage: 'r32', home: w('E'), away: t('E', 'ABCDF') },
  75: { stage: 'r32', home: w('F'), away: r('C') },
  76: { stage: 'r32', home: w('C'), away: r('F') },
  77: { stage: 'r32', home: w('I'), away: t('I', 'CDFGH') },
  78: { stage: 'r32', home: r('E'), away: r('I') },
  79: { stage: 'r32', home: w('A'), away: t('A', 'CEFHI') },
  80: { stage: 'r32', home: w('L'), away: t('L', 'EHIJK') },
  81: { stage: 'r32', home: w('D'), away: t('D', 'BEFIJ') },
  82: { stage: 'r32', home: w('G'), away: t('G', 'AEHIJ') },
  83: { stage: 'r32', home: r('K'), away: r('L') },
  84: { stage: 'r32', home: w('H'), away: r('J') },
  85: { stage: 'r32', home: w('B'), away: t('B', 'EFGIJ') },
  86: { stage: 'r32', home: w('J'), away: r('H') },
  87: { stage: 'r32', home: w('K'), away: t('K', 'DEIJL') },
  88: { stage: 'r32', home: r('D'), away: r('G') },
  89: { stage: 'r16', home: mw(74), away: mw(77) },
  90: { stage: 'r16', home: mw(73), away: mw(75) },
  91: { stage: 'r16', home: mw(76), away: mw(78) },
  92: { stage: 'r16', home: mw(79), away: mw(80) },
  93: { stage: 'r16', home: mw(83), away: mw(84) },
  94: { stage: 'r16', home: mw(81), away: mw(82) },
  95: { stage: 'r16', home: mw(86), away: mw(88) },
  96: { stage: 'r16', home: mw(85), away: mw(87) },
  97: { stage: 'qf', home: mw(89), away: mw(90) },
  98: { stage: 'qf', home: mw(93), away: mw(94) },
  99: { stage: 'qf', home: mw(91), away: mw(92) },
  100: { stage: 'qf', home: mw(95), away: mw(96) },
  101: { stage: 'sf', home: mw(97), away: mw(98) },
  102: { stage: 'sf', home: mw(99), away: mw(100) },
  103: { stage: 'third', home: ml(101), away: ml(102) },
  104: { stage: 'final', home: mw(101), away: mw(102) },
};

// Ranking FIFA provisional (junio 2026) como ULTIMO criterio de desempate. Editable.
const FIFA_RANK = {
  ARG: 1, ESP: 2, FRA: 3, ENG: 4, BRA: 5, NED: 6, POR: 7, BEL: 8, CRO: 9, GER: 10,
  MAR: 11, COL: 12, URU: 13, USA: 14, MEX: 15, SUI: 16, JPN: 17, SEN: 18, IRN: 19, KOR: 20,
  ECU: 21, AUS: 22, AUT: 23, CAN: 24, NOR: 25, EGY: 26, PAN: 27, CIV: 28, QAT: 29, KSA: 30,
  SCO: 31, PAR: 32, TUN: 33, CZE: 34, NZL: 35, UZB: 36, JOR: 37, RSA: 38, COD: 39, GHA: 40,
  CPV: 41, IRQ: 42, ALG: 43, HAI: 44, CUW: 45, BIH: 46, SWE: 47, TUR: 48,
};

// ---------- Helpers ----------
async function load(name, endpoint) {
  const cacheFile = join(CACHE, `raw_${name}.json`);
  if (!OFFLINE) {
    try {
      const res = await fetch(`${API}${endpoint}`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(json));
      return json;
    } catch (e) {
      console.warn(`! fetch ${endpoint} fallo (${e.message}); uso cache local`);
    }
  }
  if (!existsSync(cacheFile)) throw new Error(`sin red y sin cache para ${name}`);
  return JSON.parse(readFileSync(cacheFile, 'utf8'));
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const isTrue = (v) => String(v).toUpperCase() === 'TRUE';

// "MM/DD/YYYY HH:MM" -> "YYYY-MM-DDTHH:MM:00"
function toIso(local) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(local || '');
  if (!m) return null;
  const [, mm, dd, yyyy, hh, mi] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
}

function writeJson(file, data) {
  writeFileSync(join(DATA, file), JSON.stringify(data, null, 2) + '\n');
  console.log(`  -> ${file}`);
}

// ---------- Main ----------
const [teamsRaw, stadiumsRaw, gamesRaw] = await Promise.all([
  load('teams', '/get/teams'),
  load('stadiums', '/get/stadiums'),
  load('games', '/get/games'),
]);

const teams = teamsRaw.teams.map((x) => ({
  id: num(x.id),
  name: x.name_en,
  code: x.fifa_code,
  iso2: x.iso2,
  flag: x.flag,
  group: x.groups,
  fifaRank: FIFA_RANK[x.fifa_code] ?? 99,
}));

const stadiums = stadiumsRaw.stadiums.map((x) => ({
  id: num(x.id),
  name: x.fifa_name || x.name_en,
  venue: x.name_en,
  city: x.city_en,
  country: x.country_en,
  capacity: x.capacity,
}));

const games = gamesRaw.games.slice().sort((a, b) => num(a.id) - num(b.id));

const fixtures = games.map((g) => {
  const id = num(g.id);
  const base = {
    id,
    date: toIso(g.local_date),
    stadiumId: num(g.stadium_id),
  };
  if (g.type === 'group') {
    return {
      ...base,
      stage: 'group',
      group: g.group,
      matchday: num(g.matchday),
      home: { kind: 'team', teamId: num(g.home_team_id) },
      away: { kind: 'team', teamId: num(g.away_team_id) },
    };
  }
  const ko = KNOCKOUT[id];
  if (!ko) throw new Error(`partido eliminatorio ${id} sin estructura definida`);
  return { ...base, stage: ko.stage, group: null, matchday: null, home: ko.home, away: ko.away };
});

// results.json: marcadores conocidos. Fuente de la verdad editable.
// Solo pre-llenamos partidos de grupo terminados (la eliminatoria se resuelve por logica).
let results = {};
const resultsPath = join(DATA, 'results.json');
if (!REGEN_ALL && existsSync(resultsPath)) {
  results = JSON.parse(readFileSync(resultsPath, 'utf8')); // preservar correcciones manuales
}
for (const g of games) {
  if (g.type !== 'group') continue;
  const id = String(num(g.id));
  const finished = isTrue(g.finished);
  const live = g.time_elapsed === 'live';
  if (!finished && !live) continue;
  results[id] = {
    homeGoals: num(g.home_score) ?? 0,
    awayGoals: num(g.away_score) ?? 0,
    finished,
  };
}

console.log('Escribiendo datos:');
if (REGEN_ALL || !existsSync(join(DATA, 'teams.json'))) writeJson('teams.json', teams);
if (REGEN_ALL || !existsSync(join(DATA, 'stadiums.json'))) writeJson('stadiums.json', stadiums);
if (REGEN_ALL || !existsSync(join(DATA, 'fixtures.json'))) writeJson('fixtures.json', fixtures);
writeJson('results.json', results);
console.log(`OK  (${teams.length} equipos, ${fixtures.length} partidos, ${Object.keys(results).length} resultados)`);
