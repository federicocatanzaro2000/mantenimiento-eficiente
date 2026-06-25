// Generador de fechas de recurrencia para preventivos.
// Mantiene el día del mes del origen y hace clamp al último día del mes destino.

export type RepeatUnit = "day" | "week" | "month" | "year";
export type RepeatEndMode = "never" | "until" | "count";

export interface RecurrenceRule {
  every: number;
  unit: RepeatUnit;
  endMode: RepeatEndMode;
  endDate?: string | null; // ISO yyyy-mm-dd
  count?: number | null; // total ocurrencias contando la inicial
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function addInterval(base: Date, every: number, unit: RepeatUnit, originalDay: number): Date {
  if (unit === "day") {
    const d = new Date(base);
    d.setDate(d.getDate() + every);
    return d;
  }
  if (unit === "week") {
    const d = new Date(base);
    d.setDate(d.getDate() + every * 7);
    return d;
  }
  if (unit === "month") {
    const y = base.getFullYear();
    const m = base.getMonth() + every;
    const ny = y + Math.floor(m / 12);
    const nm = ((m % 12) + 12) % 12;
    const day = Math.min(originalDay, lastDayOfMonth(ny, nm));
    return new Date(ny, nm, day);
  }
  // year
  const ny = base.getFullYear() + every;
  const nm = base.getMonth();
  const day = Math.min(originalDay, lastDayOfMonth(ny, nm));
  return new Date(ny, nm, day);
}

/**
 * Devuelve TODAS las fechas ISO de la serie a partir de startISO (excluyéndola).
 * Limita por endMode y por horizonISO (cap duro).
 */
export function generateOccurrences(startISO: string, rule: RecurrenceRule, horizonISO: string): string[] {
  if (!rule.every || rule.every < 1) return [];
  const start = parseISO(startISO);
  const originalDay = start.getDate();
  const horizon = parseISO(horizonISO);
  const endDate = rule.endMode === "until" && rule.endDate ? parseISO(rule.endDate) : null;
  const maxCount = rule.endMode === "count" && rule.count && rule.count > 0 ? rule.count : null;

  const out: string[] = [];
  let current = start;
  let produced = 1; // la fecha inicial cuenta como 1
  // Safety cap absoluto (p.ej. 7d * 5000 = ~95 años); evita loops accidentales.
  const HARD_CAP = 5000;
  while (out.length < HARD_CAP) {
    current = addInterval(current, rule.every, rule.unit, originalDay);
    if (current > horizon) break;
    if (endDate && current > endDate) break;
    if (maxCount && produced + 1 > maxCount) break;
    out.push(toISO(current));
    produced++;
  }
  return out;
}

export function horizonISO(monthsAhead = 24): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return toISO(d);
}

export function describeRule(rule: RecurrenceRule, startISO: string): string {
  const unitMap: Record<RepeatUnit, string> = { day: "días", week: "semanas", month: "meses", year: "años" };
  const u = rule.every === 1 ? unitMap[rule.unit].replace(/s$/, "") : unitMap[rule.unit];
  const base = `Repetir cada ${rule.every} ${u} desde ${startISO}`;
  if (rule.endMode === "until" && rule.endDate) return `${base}, hasta ${rule.endDate}`;
  if (rule.endMode === "count" && rule.count) return `${base}, ${rule.count} ocurrencias`;
  return `${base}, sin fecha de fin`;
}
