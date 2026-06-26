# Mundial 2026 — Resultados y proyección de llaves

Herramienta web estática que muestra los resultados del **FIFA World Cup 2026™** (48 equipos,
12 grupos, 104 partidos) y **proyecta automáticamente el cuadro de eliminatorias** aplicando al
pie de la letra el reglamento oficial de la FIFA: desempates de grupo 2026, ranking de los mejores
terceros y la asignación de los 8 terceros a los 16avos según el **Anexo C** (495 combinaciones).

Incluye un **simulador "¿qué pasaría si?"**: edita los marcadores pendientes (o haz clic en el
ganador de cada cruce) y mira en vivo cómo cambian las tablas, los terceros y los cruces.

## Stack

- **React 19 + Vite + TypeScript**. Toda la lógica del torneo vive en `src/domain/` como
  **funciones puras** (testeables con Vitest).
- **Sin backend**: la app es 100% estática y lee los datos de `public/data/*.json` en runtime.
  Ideal para hosting compartido (Hostinger) o cualquier servidor de archivos.

## Desarrollo

```bash
pnpm install
pnpm dev           # servidor de desarrollo
pnpm test          # tests del dominio (desempates, Anexo C, bracket, render)
pnpm build         # build estático -> dist/
pnpm preview       # sirve dist/ localmente
```

## Datos (`public/data/`)

| Archivo            | Qué es                                              | Cómo se genera |
|--------------------|-----------------------------------------------------|----------------|
| `teams.json`       | 48 equipos (grupo, bandera, ranking FIFA)           | `pnpm data:all` |
| `stadiums.json`    | 16 sedes                                            | `pnpm data:all` |
| `fixtures.json`    | 104 partidos + esqueleto del bracket (slots 1A/2B/3.º/Ganador-M##) | `pnpm data:all` |
| `results.json`     | **Fuente de la verdad** editable: marcadores        | `pnpm data` (prellena) + edición manual |
| `annexe-c.json`    | Anexo C oficial: 495 combinaciones de terceros      | `pnpm data:annexe` |

### Actualizar resultados (uso periódico)

`results.json` es la **fuente de la verdad** y puedes editarla a mano en cualquier momento. Para
prellenarla automáticamente desde la API pública gratuita [worldcup26.ir](https://worldcup26.ir):

```bash
pnpm data          # actualiza solo results.json (respeta tus correcciones manuales)
```

> La app **recalcula** standings y bracket desde los marcadores; nunca confía en tablas externas.
> Si la API publica un dato erróneo, corrige `results.json` y listo.

### Anexo C (provenance)

`annexe-c.json` se extrae del **reglamento oficial FIFA** (`Annexe C`,
[PDF](https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf)) con
`scripts/extract-annexe.mjs`, que parsea las 495 filas y **valida** que cada asignación respete los
conjuntos de grupos permitidos por slot (art. 12.6). `pdf-parse` ya está en devDependencies.

## Reglas implementadas (FIFA WC 2026)

**Desempate de grupo** (art. 12.4) — *nuevo en 2026: el head-to-head va antes que la diferencia de
gol global*: puntos → h2h (puntos, DG, GF, con reaplicación) → DG global → GF global → fair play →
ranking FIFA. **Terceros** (art. 12.5): puntos → DG → GF → fair play → ranking FIFA.
**Asignación a 16avos**: Anexo C. Ver `src/domain/standings.ts` y `src/domain/thirdPlace.ts`.

## Despliegue en Hostinger (subdominio)

La app usa rutas relativas (`base: './'`), así que es un *drop-in* de archivos estáticos:

1. `pnpm build`
2. Sube **todo el contenido de `dist/`** a la carpeta del subdominio (p. ej. `public_html/mundial/`)
   vía el Administrador de Archivos o FTP de Hostinger.
3. Listo. Para **actualizar marcadores** sin reconstruir: ejecuta `pnpm data` localmente y
   vuelve a subir **solo** `dist/data/results.json` (la app lo lee en cada carga, con cache-busting).
