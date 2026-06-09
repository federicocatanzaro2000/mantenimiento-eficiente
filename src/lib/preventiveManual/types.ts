export type PreventiveType = "Mecánico" | "Eléctrico" | "Refrigeración" | "Lubricación" | "Limpieza" | "Cambio de aceite" | "Otro";
export const PREVENTIVE_TYPES: PreventiveType[] = ["Mecánico", "Eléctrico", "Refrigeración", "Lubricación", "Limpieza", "Cambio de aceite", "Otro"];

export type PreventiveStatus = "Programado" | "Con OIT" | "Realizado" | "Cancelado";
export const PREVENTIVE_STATUSES: PreventiveStatus[] = ["Programado", "Con OIT", "Realizado", "Cancelado"];

export type PreventiveSource = "manual" | "excel_import" | "duplicated_year";

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
}

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
}

export const STATUS_COLORS: Record<string, string> = {
  Programado: "bg-slate-200 text-slate-800 border-slate-300",
  Vencido: "bg-red-100 text-red-800 border-red-300",
  "Con OIT": "bg-amber-100 text-amber-800 border-amber-300",
  Realizado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Cancelado: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

export function effectiveStatus(it: { status: PreventiveStatus; scheduled_date: string; work_order_id: string | null }, todayISO: string): string {
  if (it.status === "Realizado" || it.status === "Cancelado" || it.status === "Con OIT") return it.status;
  if (it.work_order_id) return "Con OIT";
  if (it.scheduled_date < todayISO) return "Vencido";
  return "Programado";
}

export const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
