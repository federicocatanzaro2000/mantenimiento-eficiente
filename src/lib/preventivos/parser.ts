import * as XLSX from "xlsx";
import {
  ParsedImport, ParsedPlan, ParsedSchedule, planKeyOf,
} from "./types";
import {
  monthFromHeader, parseFrecuencia, inferTipoTarea,
  extractEquipoCodigo, isDayNumber, safeISO, normalizeText,
} from "./normalize";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function colLetter(c: number): string {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface MonthRange { month: number; start: number; end: number; }

function detectMonthRanges(rows: unknown[][]): { headerRow: number; ranges: MonthRange[] } | null {
  const maxRowsToScan = Math.min(rows.length, 6);
  for (let r = 0; r < maxRowsToScan; r++) {
    const row = rows[r] || [];
    const found: { col: number; month: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const m = monthFromHeader(row[c]);
      if (m) found.push({ col: c, month: m });
    }
    if (found.length >= 6) {
      const ranges: MonthRange[] = found.map((f, i) => ({
        month: f.month,
        start: f.col,
        end: i + 1 < found.length ? found[i + 1].col - 1 : Math.max(...row.map((_, k) => k)) + 30,
      }));
      return { headerRow: r, ranges };
    }
  }
  return null;
}

function detectYear(sheetName: string, rows: unknown[][]): number | null {
  const m = sheetName.match(/(\d{4})/);
  if (m) return Number(m[1]);
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    for (let c = 0; c < Math.min((rows[r] || []).length, 5); c++) {
      const v = rows[r]?.[c];
      if (typeof v === "number" && v >= 2000 && v <= 2100) return v;
      if (typeof v === "string") {
        const mm = v.match(/(20\d{2})/);
        if (mm) return Number(mm[1]);
      }
    }
  }
  return null;
}

const HORAS_TRABAJO_RE = /horas?\s+de\s+trabajo/;

export async function parseExcel(file: File): Promise<ParsedImport> {
  const buf = await file.arrayBuffer();
  const fileHash = await sha256Hex(buf);
  const wb = XLSX.read(buf, { type: "array" });

  const out: ParsedImport = {
    fileName: file.name,
    fileHash,
    planes: new Map(),
    schedules: [],
    hojasProcesadas: [],
    aniosDetectados: [],
    errores: [],
  };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];
    const detected = detectMonthRanges(rows);
    const year = detectYear(sheetName, rows);
    if (!detected || !year) {
      out.errores.push({ sheet: sheetName, message: "No se pudo detectar año o meses" });
      continue;
    }
    out.hojasProcesadas.push(sheetName);
    if (!out.aniosDetectados.includes(year)) out.aniosDetectados.push(year);

    let currentEquipo: { equipo: string; codigo: string | null } | null = null;
    const equipoCol = 0;
    // detect descripción/freq cols: scan a few sample rows to find first text-heavy col
    // Column convention from this file: equipo in col 0; freq + task in cols 1-3 depending on sheet.
    // We'll determine them as: equipo col = first non-empty col where month col > start; task col = last text col before first month start.
    const firstMonthCol = detected.ranges[0].start;

    for (let r = detected.headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];

      // Try to detect equipo on left columns (before first month col)
      // Equipo row: cell in col 0 (or 1) has text AND second col is "Horas de trabajo" OR cell looks like equipment name with code
      let foundEquipo: string | null = null;
      for (let c = 0; c < Math.min(firstMonthCol, 3); c++) {
        const v = row[c];
        if (typeof v === "string" && v.trim()) {
          const next = row[c + 1];
          if (typeof next === "string" && HORAS_TRABAJO_RE.test(normalizeText(next))) {
            foundEquipo = v;
            break;
          }
          // also accept obvious equipment-like names (with parens) without "horas de trabajo"
          if (/\(/.test(v) && v.length < 80) {
            foundEquipo = v;
            break;
          }
        }
      }
      if (foundEquipo) {
        currentEquipo = extractEquipoCodigo(foundEquipo);
        continue;
      }

      // Skip "horas de trabajo" rows
      const rowText = row.map((v) => normalizeText(v)).join(" ");
      if (HORAS_TRABAJO_RE.test(rowText) && !row.some((v, c) => c >= firstMonthCol && isDayNumber(v))) continue;

      // Find task: look across cols < firstMonthCol for the longest text cell (descripción) and another text cell as frecuencia
      let tarea: string | null = null;
      let tareaCol = -1;
      let frecRaw: unknown = null;
      for (let c = firstMonthCol - 1; c >= 0; c--) {
        const v = row[c];
        if (typeof v === "string" && v.trim() && v.trim().length > 4) {
          tarea = v.trim();
          tareaCol = c;
          break;
        }
      }
      if (tarea) {
        for (let c = 0; c < tareaCol; c++) {
          const v = row[c];
          if (v !== null && v !== undefined && String(v).trim()) {
            frecRaw = v;
            break;
          }
        }
      }

      // Detect numeric values in month ranges anyway
      const monthHits: { range: MonthRange; col: number; raw: unknown; day: number | null }[] = [];
      for (const range of detected.ranges) {
        for (let c = range.start; c <= range.end && c < row.length; c++) {
          const v = row[c];
          if (v === null || v === undefined) continue;
          const s = String(v).trim();
          if (!s) continue;
          monthHits.push({ range, col: c, raw: v, day: isDayNumber(v) });
        }
      }

      if (!tarea && monthHits.length === 0) continue;
      if (!tarea || !currentEquipo) continue;

      const frec = parseFrecuencia(frecRaw);
      const plan: ParsedPlan = {
        equipo: currentEquipo.equipo,
        equipo_codigo: currentEquipo.codigo,
        tarea,
        tipo_tarea: inferTipoTarea(tarea),
        frecuencia_texto: frec.texto,
        frecuencia_valor: frec.valor,
        frecuencia_unidad: frec.unidad,
        source_sheet: sheetName,
        source_row: r + 1,
      };
      const key = planKeyOf(plan);
      if (!out.planes.has(key)) out.planes.set(key, plan);

      for (const hit of monthHits) {
        const cellRef = `${colLetter(hit.col)}${r + 1}`;
        if (hit.day !== null) {
          const iso = safeISO(year, hit.range.month, hit.day);
          out.schedules.push({
            planKey: key,
            anio: year,
            mes: hit.range.month,
            dia: hit.day,
            scheduled_date: iso,
            source_cell: cellRef,
            import_notes: null,
            estado: iso ? "Programado" : "Requiere revisión",
          });
        } else {
          out.schedules.push({
            planKey: key,
            anio: year,
            mes: hit.range.month,
            dia: null,
            scheduled_date: null,
            source_cell: cellRef,
            import_notes: `Valor no numérico: "${String(hit.raw)}"`,
            estado: "Requiere revisión",
          });
        }
      }
    }
  }

  return out;
}
