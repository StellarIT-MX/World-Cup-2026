#!/usr/bin/env node
// Regenera public/data/annexe-c.json a partir del reglamento OFICIAL FIFA World Cup 2026
// (Anexo C: las 495 combinaciones de los 8 mejores terceros y su cruce en 16avos).
//
// Requiere pdf-parse (no es dependencia por defecto):  npm i -D pdf-parse
// Uso:  node scripts/extract-annexe.mjs
//
// Fuente: https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
// El PDF se cachea en scripts/.cache/fifa_regs.pdf para reproducibilidad offline.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE = join(__dirname, '.cache');
const PDF = join(CACHE, 'fifa_regs.pdf');
const PDF_URL = 'https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf';

// Orden de columnas del Anexo C = ganadores ordenados alfabeticamente -> slot (M##).
// Derivado y verificado contra los allowed-sets de cada slot (art. 12.6 del reglamento).
const COL_WINNER = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'];
const ALLOWED = {
  A: 'CEFHI', B: 'EFGIJ', D: 'BEFIJ', E: 'ABCDF', G: 'AEHIJ', I: 'CDFGH', K: 'DEIJL', L: 'EHIJK',
};

let pdfParse;
try {
  // Importamos el modulo de libreria directamente: el index.js de pdf-parse ejecuta
  // codigo de debug al cargarse como ESM y fallaria.
  pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
} catch {
  console.error('Falta pdf-parse. Instala con:  npm i -D pdf-parse');
  process.exit(1);
}

if (!existsSync(PDF)) {
  console.log('Descargando reglamento FIFA...');
  const res = await fetch(PDF_URL, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`No se pudo descargar el PDF (HTTP ${res.status})`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(PDF, Buffer.from(await res.arrayBuffer()));
}

const { text } = await pdfParse(readFileSync(PDF));

// Cada fila del Anexo C: <numero> seguido de exactamente 8 tokens "3X", en su propia linea.
const rowRe = /^(\d+)((?:3[A-L]){8})$/;
const lookup = {};
let bad = 0;
for (const line of text.split('\n')) {
  const m = rowRe.exec(line.trim());
  if (!m) continue;
  const toks = [...m[2].matchAll(/3([A-L])/g)].map((x) => x[1]);
  if (toks.length !== 8) continue;
  const valid = toks.every((g, i) => ALLOWED[COL_WINNER[i]].includes(g));
  if (!valid) { bad++; continue; }
  const key = toks.slice().sort().join('');
  lookup[key] = Object.fromEntries(COL_WINNER.map((w, i) => [w, toks[i]]));
}

const n = Object.keys(lookup).length;
if (n !== 495 || bad > 0) {
  throw new Error(`Validacion fallida: ${n} combinaciones (esperado 495), ${bad} filas invalidas`);
}
writeFileSync(join(ROOT, 'public', 'data', 'annexe-c.json'), JSON.stringify(lookup, null, 0) + '\n');
console.log(`OK: ${n} combinaciones extraidas y validadas -> public/data/annexe-c.json`);
