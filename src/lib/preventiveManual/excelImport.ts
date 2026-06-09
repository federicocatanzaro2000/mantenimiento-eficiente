import * as XLSX from "xlsx";
import { Equipment } from "@/lib/catalogos/api";
import { PreventiveItemInput, PreventiveType } from "./types";

const MONTH_KEYWORDS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre"];

export interface ImportEquipmentRef {
  code: string;
  name: string;
  rawLabel: string;
}

export interface ImportPreview {
  totalDetected: number;
  toInsert: PreventiveItemInput[];
  yearsDetected: number[];
  equipmentsFound: ImportEquipmentRef[];
  equipmentsNotFound: ImportEquipmentRef[];
  ignoredRows: number;
  errors: string[];
}

function norm(s: any): string {
  return (s ?? "").toString().trim();
}

function inferType(task: string): PreventiveType {
  const t = task.toLowerCase();
  if (t.includes("aceite")) return "Cambio de aceite";
  if (t.includes("mecanic") || t.includes("mecánic")) return "Mecánico";
  if (t.includes("electric") || t.includes("eléctric")) return "Eléctrico";
  if (t.includes("refriger")) return "Refrigeración";
  if (t.includes("lubric")) return "Lubricación";
  if (t.includes("limpie")) return "Limpieza";
  return "Otro";
}

function parseEquipmentLabel(label: string): { name: string; code: string } | null {
  // patterns like "Extrusora (EX1)" or "EXTRUSORA   (EX3)"
  const m = label.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return null;
  return { name: m[1].trim(), code: m[2].trim() };
}

function extractYearFromSheetName(name: string): number | null {
  const m = name.match(/(20\d{2}|19\d{2})/);
  return m ? Number(m[1]) : null;
}

function isValidDay(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const last = new Date(year, month, 0).getDate();
  return day <= last;
}

// Detect month columns from header row(s): scan up to first ~10 rows for a row containing month names
function findMonthColumns(rows: any[][]): { headerRow: number; monthCols: Record<number, number[]> } | null {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    const matches: { col: number; monthIdx: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const v = norm(row[c]).toLowerCase();
      if (!v) continue;
      const idx = MONTH_KEYWORDS.indexOf(v);
      if (idx >= 0) {
        const month = idx === 10 ? 9 : idx > 10 ? idx - 1 : idx; // setiembre = octubre? handle below
        // Map: enero=0,...,septiembre/setiembre=8, octubre=9, noviembre=10, diciembre=11
        const monthFix = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].indexOf(
          v === "setiembre" ? "septiembre" : v
        );
        if (monthFix >= 0) matches.push({ col: c, monthIdx: monthFix });
      }
    }
    if (matches.length >= 6) {
      // Build month → [colStart, colEnd) using next month start as boundary
      const sorted = matches.sort((a, b) => a.col - b.col);
      const monthCols: Record<number, number[]> = {};
      for (let i = 0; i < sorted.length; i++) {
        const next = sorted[i + 1];
        const end = next ? next.col : sorted[i].col + 5;
        const cols: number[] = [];
        for (let c = sorted[i].col; c < end; c++) cols.push(c);
        monthCols[sorted[i].monthIdx + 1] = cols; // 1-based month
      }
      return { headerRow: r, monthCols };
    }
  }
  return null;
}

export async function parseExcelFile(file: File, equipment: Equipment[]): Promise<ImportPreview> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const equipmentByCode = new Map<string, Equipment>();
  equipment.forEach((e) => equipmentByCode.set(e.code.toLowerCase(), e));

  const toInsert: PreventiveItemInput[] = [];
  const yearsDetected = new Set<number>();
  const foundMap = new Map<string, ImportEquipmentRef>();
  const notFoundMap = new Map<string, ImportEquipmentRef>();
  let ignoredRows = 0;
  const errors: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const year = extractYearFromSheetName(sheetName);
    if (!year) {
      errors.push(`Hoja "${sheetName}" sin año detectable, omitida`);
      continue;
    }
    yearsDetected.add(year);
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: true }) as any[][];
    const monthInfo = findMonthColumns(rows);
    if (!monthInfo) {
      errors.push(`Hoja "${sheetName}": no se detectaron columnas de meses`);
      continue;
    }
    const { headerRow, monthCols } = monthInfo;
    // Find which columns are "label" (equipment/frequency/task). Typically before first month column.
    const firstMonthCol = Math.min(...Object.values(monthCols).flat());
    const labelCols = Array.from({ length: firstMonthCol }, (_, i) => i);

    let currentEquipment: { name: string; code: string; ref: Equipment | null } | null = null;

    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      // Check if this row has an equipment label in label columns
      let equipLabel: string | null = null;
      for (const c of labelCols) {
        const v = norm(row[c]);
        if (v && parseEquipmentLabel(v)) { equipLabel = v; break; }
      }
      if (equipLabel) {
        const parsed = parseEquipmentLabel(equipLabel)!;
        const ref = equipmentByCode.get(parsed.code.toLowerCase()) ?? null;
        currentEquipment = { name: parsed.name, code: parsed.code, ref };
        const refObj: ImportEquipmentRef = { code: parsed.code, name: ref?.name ?? parsed.name, rawLabel: equipLabel };
        if (ref) foundMap.set(parsed.code.toLowerCase(), refObj);
        else notFoundMap.set(parsed.code.toLowerCase(), refObj);
        continue;
      }
      if (!currentEquipment) { ignoredRows++; continue; }

      // Find task name and frequency label in label cols
      let taskName = "";
      let freqLabel = "";
      // typical: label cols include [equip?, freq, task] — find rightmost non-empty text col(s)
      const texts: { col: number; v: string }[] = [];
      for (const c of labelCols) {
        const v = norm(row[c]);
        if (v) texts.push({ col: c, v });
      }
      if (texts.length === 0) { ignoredRows++; continue; }
      // Last text = task, previous = frequency
      taskName = texts[texts.length - 1].v;
      if (texts.length >= 2) freqLabel = texts[texts.length - 2].v;

      // Skip auxiliary rows
      const tLow = taskName.toLowerCase();
      if (tLow.includes("horas de trabajo") || tLow.includes("horas totales") || tLow === "observaciones") {
        ignoredRows++;
        continue;
      }
      // Skip if task is purely numeric
      if (/^\d+(\.\d+)?$/.test(taskName)) { ignoredRows++; continue; }

      // Iterate month columns
      let rowHadData = false;
      for (const monthStr of Object.keys(monthCols)) {
        const month = Number(monthStr);
        const cols = monthCols[month];
        const days: number[] = [];
        for (const c of cols) {
          const v = row[c];
          if (v === null || v === undefined || v === "") continue;
          const num = typeof v === "number" ? v : Number(String(v).trim());
          if (!Number.isFinite(num)) continue;
          if (!Number.isInteger(num)) continue;
          if (num < 1 || num > 31) continue;
          if (!isValidDay(num, month, year)) continue;
          if (!days.includes(num)) days.push(num);
        }
        for (const day of days) {
          rowHadData = true;
          const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          if (!currentEquipment.ref) continue; // skip but counted in notFound
          toInsert.push({
            scheduled_date: dateISO,
            equipment_id: currentEquipment.ref.id,
            equipment_code_snapshot: currentEquipment.ref.code,
            equipment_name_snapshot: currentEquipment.ref.name,
            task_name: taskName,
            preventive_type: inferType(taskName),
            frequency_label: freqLabel || null,
            source: "excel_import",
          });
        }
      }
      if (!rowHadData) ignoredRows++;
    }
  }

  return {
    totalDetected: toInsert.length,
    toInsert,
    yearsDetected: Array.from(yearsDetected).sort(),
    equipmentsFound: Array.from(foundMap.values()),
    equipmentsNotFound: Array.from(notFoundMap.values()),
    ignoredRows,
    errors,
  };
}
