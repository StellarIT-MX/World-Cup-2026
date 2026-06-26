// Offsets UTC de cada sede para el verano 2026.
// México eliminó el horario de verano en 2023 → CST fijo = UTC-6.
// EE.UU./Canadá siguen cambiando: CDT = UTC-5, EDT = UTC-4, PDT = UTC-7.
const STADIUM_UTC_OFFSET: Record<number, number> = {
  1: -6,  // Ciudad de México (CST)
  2: -6,  // Guadalajara (CST)
  3: -6,  // Monterrey (CST)
  4: -5,  // Dallas — CDT
  5: -5,  // Houston — CDT
  6: -5,  // Kansas City — CDT
  7: -4,  // Atlanta — EDT
  8: -4,  // Miami — EDT
  9: -4,  // Boston — EDT
  10: -4, // Philadelphia — EDT
  11: -4, // New York/New Jersey — EDT
  12: -4, // Toronto — EDT
  13: -7, // Vancouver — PDT
  14: -7, // Seattle — PDT
  15: -7, // San Francisco — PDT
  16: -7, // Los Ángeles — PDT
};

const GDL_OFFSET = -6; // UTC-6 (CST permanente)

/**
 * Convierte una fecha en hora local de la sede a hora de Guadalajara (UTC-6).
 * Las fechas en fixtures.json están en hora local del estadio, sin sufijo de zona.
 */
export function formatMatchTime(dateStr: string, stadiumId: number): string {
  const localOffset = STADIUM_UTC_OFFSET[stadiumId] ?? GDL_OFFSET;
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // hora local → UTC: UTC_hora = local_hora - offset_local (offset es negativo)
  const utcMs = Date.UTC(year, month - 1, day, hour - localOffset, minute);
  // UTC → GDL (UTC-6)
  const gdlDate = new Date(utcMs + GDL_OFFSET * 3_600_000);
  const dd = String(gdlDate.getUTCDate()).padStart(2, '0');
  const mm = String(gdlDate.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(gdlDate.getUTCHours()).padStart(2, '0');
  const min = String(gdlDate.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}
