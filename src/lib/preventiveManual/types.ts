export type PreventiveType = "Mecánico" | "Eléctrico" | "Refrigeración" | "Lubricación" | "Limpieza" | "Cambio de aceite" | "Otro";
export const PREVENTIVE_TYPES: PreventiveType[] = ["Mecánico", "Eléctrico", "Refrigeración", "Lubricación", "Limpieza", "Cambio de aceite", "Otro"];

export type PreventiveStatus = "Programado" | "Con OIT" | "Realizado" | "Cancelado";
export const PREVENTIVE_STATUSES: PreventiveStatus[] = ["Programado", "Con OIT", "Realizado", "Cancelado"];

export type PreventiveSource = "manual" | "excel_import" | "duplicated_year";

export type RepeatUnit = "day" | "week" | "month" | "year";
export type RepeatEndMode = "never" | "until" | "count";

export interface PreventiveItem {
  id: string;
  scheduled_date: string;
  scheduled_year: number;
  scheduled_month: number;
  scheduled_day: number;
  equipment_id: string | null;
  equipment_code_snapshot: string;
  equipment_name_snapshot: string;
  task_name: string;
  preventive_type: PreventiveType;
  frequency_label: string | null;
  status: PreventiveStatus;
  responsible_id: string | null;
  estimated_hours: number | null;
  notes: string | null;
  work_order_id: string | null;
  source: PreventiveSource;
  active: boolean;
  created_at: string;
  updated_at: string;
  recurrence_parent_id: string | null;
  is_recurrence_parent: boolean;
  repeat_enabled: boolean;
  repeat_every: number | null;
  repeat_unit: RepeatUnit | null;
  repeat_end_mode: RepeatEndMode | null;
  repeat_end_date: string | null;
  repeat_count: number | null;
  materiales_previstos?: any;
  /** Estado de la OIT asociada (si existe), enriquecido por listPreventives. */
  work_order_estado?: string | null;
}

export interface PreventiveMaterial {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number | "";
  unidad?: string;
  observaciones?: string;
  lote?: string;
  fechaVencimiento?: string;
}

export const MATERIAL_UNITS = ["unidad", "kg", "litros", "metros", "paquetes", "cajas"] as const;


export interface PreventiveItemInput {
  scheduled_date: string;
  equipment_id?: string | null;
  equipment_code_snapshot: string;
  equipment_name_snapshot: string;
  task_name: string;
  preventive_type: PreventiveType;
  frequency_label?: string | null;
  status?: PreventiveStatus;
  responsible_id?: string | null;
  estimated_hours?: number | null;
  notes?: string | null;
  source?: PreventiveSource;
  materiales_previstos?: PreventiveMaterial[] | null;

}

export interface RecurrenceInput {
  repeat_enabled: boolean;
  repeat_every?: number | null;
  repeat_unit?: RepeatUnit | null;
  repeat_end_mode?: RepeatEndMode | null;
  repeat_end_date?: string | null;
  repeat_count?: number | null;
}

export const STATUS_COLORS: Record<string, string> = {
  Programado: "bg-slate-200 text-slate-800 border-slate-300",
  Próximo: "bg-amber-200 text-amber-900 border-amber-400",
  Vencido: "bg-red-100 text-red-800 border-red-300",
  "En proceso": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Con OIT": "bg-amber-100 text-amber-800 border-amber-300",
  Realizado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Cancelado: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

/**
 * Fecha "hoy" en zona horaria America/Argentina/Buenos_Aires (YYYY-MM-DD).
 */
export function todayISOArgentina(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/**
 * Diferencia en días calendario entre dos fechas ISO (YYYY-MM-DD), sin horas.
 * Positivo si `dateISO` es posterior a `refISO`.
 */
export function daysBetweenISO(dateISO: string, refISO: string): number {
  const [y1, m1, d1] = dateISO.split("-").map(Number);
  const [y2, m2, d2] = refISO.split("-").map(Number);
  const a = Date.UTC(y1, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((a - b) / 86400000);
}

/** Estados de OIT considerados "cumplido/cerrado". */
const OIT_ESTADOS_CUMPLIDOS = new Set(["Cumplido", "Completado", "Finalizada", "Finalizado"]);
/** Estados de OIT considerados "en curso". */
const OIT_ESTADOS_EN_PROCESO = new Set(["En proceso", "En Proceso", "En ejecución"]);

/**
 * Estado visual único y centralizado de un preventivo. Regla de prioridad
 * (definida por el negocio):
 *   1. Cumplido    → si el preventivo o su OIT están cumplidos.
 *   2. Cancelado   → si el preventivo fue cancelado.
 *   3. Vencido     → si la fecha programada ya pasó y no está cumplido.
 *   4. Próximo     → si faltan entre 0 y 7 días.
 *   5. En proceso  → si la OIT asociada está en ejecución.
 *   6. Con OIT     → si existe OIT asociada pendiente.
 *   7. Programado  → resto (vigente, faltan más de 7 días y sin OIT).
 *
 * El preventivo NUNCA se oculta por tener OIT: siempre devuelve un estado.
 */
export function effectiveStatus(
  it: { status: PreventiveStatus; scheduled_date: string; work_order_id: string | null; work_order_estado?: string | null },
  todayISO: string,
): string {
  const oitEstado = it.work_order_estado ?? null;
  // 1) Cumplido (preventivo marcado como Realizado o su OIT cumplida)
  if (it.status === "Realizado" || (oitEstado && OIT_ESTADOS_CUMPLIDOS.has(oitEstado))) return "Realizado";
  // 2) Cancelado
  if (it.status === "Cancelado") return "Cancelado";
  // 3) Vencido — fecha pasada y no cumplido
  if (it.scheduled_date) {
    const diff = daysBetweenISO(it.scheduled_date, todayISO);
    if (diff < 0) return "Vencido";
    // 4) Próximo (0..7 días)
    if (diff <= 7) return "Próximo";
  }
  // 5) En proceso
  if (oitEstado && OIT_ESTADOS_EN_PROCESO.has(oitEstado)) return "En proceso";
  // 6) Con OIT pendiente
  if (it.status === "Con OIT" || it.work_order_id) return "Con OIT";
  // 7) Programado
  return "Programado";
}

export const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
