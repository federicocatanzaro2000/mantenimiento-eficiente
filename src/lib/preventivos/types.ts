export type EstadoPreventivo =
  | "Programado"
  | "Próximo"
  | "OT creada"
  | "En proceso"
  | "Completado"
  | "Vencido"
  | "Reprogramado"
  | "Cancelado"
  | "Requiere revisión";

export const TIPOS_TAREA = [
  "Mecánico",
  "Eléctrico",
  "Refrigeración",
  "Lubricación",
  "Cambio de aceite",
  "Limpieza",
  "Otro",
] as const;
export type TipoTarea = typeof TIPOS_TAREA[number];

export interface PreventivoPlan {
  id: string;
  equipo: string;
  equipo_codigo: string | null;
  tarea: string;
  tipo_tarea: TipoTarea | null;
  frecuencia_texto: string | null;
  frecuencia_valor: number | null;
  frecuencia_unidad: "horas" | "meses" | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreventivoSchedule {
  id: string;
  plan_id: string;
  scheduled_date: string | null;
  anio: number;
  mes: number;
  dia: number | null;
  estado: EstadoPreventivo;
  orden_id: string | null;
  fecha_real: string | null;
  observaciones: string | null;
  import_notes: string | null;
  source_cell: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreventivoScheduleConPlan extends PreventivoSchedule {
  plan: PreventivoPlan;
}

export interface ParsedPlan {
  equipo: string;
  equipo_codigo: string | null;
  tarea: string;
  tipo_tarea: TipoTarea | null;
  frecuencia_texto: string | null;
  frecuencia_valor: number | null;
  frecuencia_unidad: "horas" | "meses" | null;
  source_sheet: string;
  source_row: number;
}

export interface ParsedSchedule {
  planKey: string; // matches ParsedPlan key
  anio: number;
  mes: number;
  dia: number | null;
  scheduled_date: string | null;
  source_cell: string;
  import_notes: string | null;
  estado: EstadoPreventivo;
}

export interface ParsedImport {
  fileName: string;
  fileHash: string;
  planes: Map<string, ParsedPlan>;
  schedules: ParsedSchedule[];
  hojasProcesadas: string[];
  aniosDetectados: number[];
  errores: { sheet: string; row?: number; col?: number; message: string }[];
}

export const ESTADO_COLOR: Record<EstadoPreventivo, string> = {
  "Programado": "bg-slate-200 text-slate-800",
  "Próximo": "bg-amber-200 text-amber-900",
  "OT creada": "bg-blue-200 text-blue-900",
  "En proceso": "bg-indigo-200 text-indigo-900",
  "Completado": "bg-emerald-200 text-emerald-900",
  "Vencido": "bg-red-200 text-red-900",
  "Reprogramado": "bg-purple-200 text-purple-900",
  "Cancelado": "bg-zinc-200 text-zinc-700",
  "Requiere revisión": "bg-orange-200 text-orange-900",
};

export function planKeyOf(p: Pick<ParsedPlan, "equipo" | "equipo_codigo" | "tarea" | "source_sheet" | "frecuencia_texto">) {
  return [p.equipo, p.equipo_codigo ?? "", p.tarea, p.frecuencia_texto ?? "", p.source_sheet].join("|");
}

export function computeStatusBy(scheduled: string | null, current: EstadoPreventivo, todayISO: string): EstadoPreventivo {
  if (["Completado", "Cancelado", "Reprogramado", "OT creada", "En proceso", "Requiere revisión"].includes(current)) return current;
  if (!scheduled) return current;
  const diff = Math.round((+new Date(scheduled) - +new Date(todayISO)) / 86400000);
  if (diff < 0) return "Vencido";
  if (diff <= 15) return "Próximo";
  return "Programado";
}
