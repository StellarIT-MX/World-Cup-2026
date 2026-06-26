# CLAUDE.md

App (React + TypeScript + Vite) para seguir y **simular** la Copa Mundial de la FIFA
2026 (formato nuevo de 48 equipos): tablas de grupos en vivo, ranking de mejores
terceros, y bracket de eliminatoria que se resuelve solo conforme entran resultados.

## Comandos

> Usar **pnpm**, no npm (preferencia del usuario por seguridad).

- `pnpm dev` — servidor de desarrollo (Vite).
- `pnpm build` — `tsc -b && vite build`.
- `pnpm test` — vitest run (los tests de dominio viven en `src/domain/__tests__`).
- `pnpm lint` — oxlint.
- `pnpm data` / `pnpm data:annexe` — scripts de ingestión de datos (`scripts/*.mjs`).

## Datos

`public/data/` es la fuente de verdad que carga la app:
`teams.json` (48), `fixtures.json` (104), `results.json`, `stadiums.json`,
`annexe-c.json` (495 combinaciones). `results.json` es lo que cambia partido a partido.

## Formato del torneo (FIFA World Cup 2026) — ratificado

- **48 equipos** en **12 grupos (A–L) de 4**.
- **104 partidos**: 72 de grupo + 16 dieciseisavos (R32) + 8 octavos (R16) +
  4 cuartos + 2 semis + 1 de tercer lugar + 1 final.
- **Clasifican a la eliminatoria 32 equipos**:
  - los **1.º y 2.º** de cada grupo (24), y
  - los **8 mejores terceros** de entre los 12 terceros de grupo.
- La eliminatoria arranca en **dieciseisavos (Round of 32)**, no en octavos.

### Reglas de tabla de grupos (Reglamento art. 12.4) — orden de desempate

Implementado en `src/domain/standings.ts`. El orden EXACTO es:

1. Puntos en todos los partidos del grupo.

   *Entre equipos empatados en puntos se aplica una "mini-liga" head-to-head:*
2. Puntos en los partidos entre los equipos empatados.
3. Diferencia de gol en esos partidos.
4. Goles a favor en esos partidos.

   Si los criterios 2–4 separan a unos pero no a todos, se **reaplican 2–4 solo
   al subgrupo que sigue empatado** (recursión — ver `breakTie`).

   *Si el head-to-head no separa a nadie, se cae a criterios globales:*
5. Diferencia de gol global.
6. Goles a favor global.
7. Fair play (menos puntos de sanción por tarjetas = mejor).
8. Ranking FIFA (número más bajo = mejor).

### Reglas de ranking de los 12 terceros (art. 12.5)

Implementado en `src/domain/thirdPlace.ts` (`rankThirdPlaced`). Como cada tercero
viene de un grupo distinto, NO hay head-to-head; el orden es por stats globales:

1. Puntos → 2. Diferencia de gol → 3. Goles a favor → 4. Fair play → 5. Ranking FIFA.

Los **8 primeros (`thirdRank` 1..8) clasifican** (`qualifies: true`).

### Asignación de terceros al bracket — Anexo C

`public/data/annexe-c.json` + `resolveThirdAllocation` (`src/domain/thirdPlace.ts`).
Cuál tercero va a qué llave depende de **qué combinación de 8 grupos** aportó los
terceros clasificados. Hay **495 combinaciones** posibles (C(12,8)); el JSON mapea
cada combinación (clave ordenada, p.ej. `"ABCDEFGH"`) a `{ grupoGanador: grupoTercero }`.
La asignación solo se resuelve cuando se conocen los 8 terceros definitivos.

## Arquitectura

Todo el cálculo es **puro y determinista**, separado de la UI:

- `src/domain/types.ts` — tipos del dominio. `TeamRef` modela slots del bracket
  sin resolver (`winner-group`, `runner-group`, `third`, `match-winner`, ...).
- `src/domain/standings.ts` — cálculo de tablas + desempates art. 12.4.
- `src/domain/thirdPlace.ts` — ranking de terceros + asignación Anexo C.
- `src/domain/bracket.ts` — resuelve cada slot del bracket a un equipo concreto
  conforme entran resultados (memoizado, corta ciclos).
- `src/domain/engine.ts` — orquesta: standings → thirds → allocation → bracket.
- `src/hooks/useTournament.ts` — estado, overrides de simulación, carga de datos.
- `src/components/` — `GroupsView`, `ThirdPlaceView`, `BracketView`, `Flag`.

**Partidos "en curso" (live)**: tanto `finished` como `live` cuentan para las
tablas de grupo (ver `playedGroupMatches`), pero un grupo solo está `groupComplete`
cuando sus 6 partidos están `finished`.

### ⚠️ Nota sobre `GroupsView.tsx`

El estilo `pos--third` en `GroupsView` se aplica a **todos los terceros de los 12
grupos** (es solo indicación visual de "posición 3"), NO marca a los 8 mejores
terceros reales. El cálculo real de qué terceros clasifican vive en
`thirdPlace.ts` y se muestra en `ThirdPlaceView` ("Mejores terceros").
