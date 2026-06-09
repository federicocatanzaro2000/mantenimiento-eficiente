import * as XLSX from "xlsx";
import { PreventiveItem, MONTH_NAMES } from "./types";

export function exportYearToExcel(year: number, items: PreventiveItem[]) {
  // Group by equipment + task + frequency
  type Key = string;
  const map = new Map<Key, { code: string; name: string; freq: string; task: string; type: string; months: Record<number, number[]> }>();
  for (const it of items) {
    const k = `${it.equipment_code_snapshot}|${it.task_name}|${it.frequency_label ?? ""}`;
    let row = map.get(k);
    if (!row) {
      row = { code: it.equipment_code_snapshot, name: it.equipment_name_snapshot, freq: it.frequency_label ?? "", task: it.task_name, type: it.preventive_type, months: {} };
      map.set(k, row);
    }
    if (!row.months[it.scheduled_month]) row.months[it.scheduled_month] = [];
    row.months[it.scheduled_month].push(it.scheduled_day);
  }
  const header = ["Código", "Equipo", "Frecuencia", "Tarea", "Tipo", ...MONTH_NAMES];
  const aoa: any[][] = [header];
  const sorted = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code) || a.task.localeCompare(b.task));
  for (const r of sorted) {
    const cells = [r.code, r.name, r.freq, r.task, r.type];
    for (let m = 1; m <= 12; m++) {
      const days = (r.months[m] ?? []).sort((a, b) => a - b);
      cells.push(days.join(", "));
    }
    aoa.push(cells);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(year));
  XLSX.writeFile(wb, `INCALFOOD Preventivos ${year}.xlsx`);
}
