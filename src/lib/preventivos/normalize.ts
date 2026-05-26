import { TipoTarea } from "./types";

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(s: unknown): string {
  if (s === null || s === undefined) return "";
  return stripDiacritics(String(s)).trim().toLowerCase().replace(/\s+/g, " ");
}

const MESES_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

export function monthFromHeader(s: unknown): number | null {
  const n = normalizeText(s);
  if (!n) return null;
  return MESES_MAP[n] ?? null;
}

export function parseFrecuencia(raw: unknown): {
  texto: string | null;
  valor: number | null;
  unidad: "horas" | "meses" | null;
} {
  if (raw === null || raw === undefined) return { texto: null, valor: null, unidad: null };
  const text = String(raw).trim();
  if (!text || text === "-") return { texto: text || null, valor: null, unidad: null };
  const n = normalizeText(text);
  const m = n.match(/(\d+(?:[.,]\d+)?)\s*(hs|h|horas|hora|mes|meses)/);
  if (m) {
    const valor = Number(m[1].replace(",", "."));
    const u = m[2];
    const unidad = u.startsWith("h") ? "horas" : "meses";
    return { texto: text, valor, unidad };
  }
  return { texto: text, valor: null, unidad: null };
}

export function inferTipoTarea(taskName: string): TipoTarea | null {
  const n = normalizeText(taskName);
  if (!n) return null;
  if (n.includes("aceite")) return "Cambio de aceite";
  if (n.includes("lubric")) return "Lubricación";
  if (n.includes("refriger")) return "Refrigeración";
  if (n.includes("mecan")) return "Mecánico";
  if (n.includes("electric") || n.includes("electr")) return "Eléctrico";
  if (n.includes("limpieza")) return "Limpieza";
  if (n.includes("rodamiento") || n.includes("correa") || n.includes("reten")) return "Mecánico";
  return "Otro";
}

export function extractEquipoCodigo(equipo: string): { nombre: string; codigo: string | null } {
  const cleaned = equipo.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { nombre: m[1].trim(), codigo: m[2].trim() };
  return { nombre: cleaned, codigo: null };
}

export function isDayNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s.replace(",", ".")));
  if (n >= 1 && n <= 31) return n;
  return null;
}

export function safeISO(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  return d.toISOString().slice(0, 10);
}
