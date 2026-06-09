import { supabase } from "@/integrations/supabase/client";
import { ParsedImport, PreventivoPlan, PreventivoSchedule, PreventivoScheduleConPlan, EstadoPreventivo, planKeyOf, computeStatusBy } from "./types";

export async function fetchPlanes(): Promise<PreventivoPlan[]> {
  const { data, error } = await supabase.from("preventivos_planes").select("*").order("equipo");
  if (error) throw error;
  return (data ?? []) as PreventivoPlan[];
}

export async function fetchSchedule(): Promise<PreventivoScheduleConPlan[]> {
  const { data, error } = await supabase
    .from("preventivos_schedule")
    .select("*, plan:preventivos_planes(*)")
    .order("scheduled_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as PreventivoScheduleConPlan[];
}

export async function updateScheduleEstado(id: string, estado: EstadoPreventivo, fecha_real?: string | null, observaciones?: string | null) {
  const patch: { estado: EstadoPreventivo; fecha_real?: string | null; observaciones?: string | null } = { estado };
  if (fecha_real !== undefined) patch.fecha_real = fecha_real;
  if (observaciones !== undefined) patch.observaciones = observaciones;
  const { error } = await supabase.from("preventivos_schedule").update(patch).eq("id", id);
  if (error) throw error;
}

export async function reprogramarSchedule(id: string, nuevaFecha: string) {
  const d = new Date(nuevaFecha);
  const { error } = await supabase.from("preventivos_schedule").update({
    scheduled_date: nuevaFecha,
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    estado: "Reprogramado",
  }).eq("id", id);
  if (error) throw error;
}

export async function eliminarSchedule(id: string) {
  const { error } = await supabase.from("preventivos_schedule").delete().eq("id", id);
  if (error) throw error;
}

export async function eliminarPlan(id: string) {
  const { error } = await supabase.from("preventivos_planes").delete().eq("id", id);
  if (error) throw error;
}

export async function crearPlanManual(plan: Omit<PreventivoPlan, "id" | "created_at" | "updated_at" | "activo">): Promise<PreventivoPlan> {
  const { data, error } = await supabase.from("preventivos_planes").insert(plan).select().single();
  if (error) throw error;
  return data as PreventivoPlan;
}

export async function crearScheduleManual(s: { plan_id: string; scheduled_date: string; observaciones?: string }): Promise<PreventivoSchedule> {
  const d = new Date(s.scheduled_date);
  const { data, error } = await supabase.from("preventivos_schedule").insert({
    plan_id: s.plan_id,
    scheduled_date: s.scheduled_date,
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    observaciones: s.observaciones ?? "",
    source_cell: "manual",
    estado: "Programado",
  }).select().single();
  if (error) throw error;
  return data as PreventivoSchedule;
}

export async function vincularOrden(scheduleId: string, ordenId: string) {
  const { error: e1 } = await supabase.from("ordenes").update({ preventivo_schedule_id: scheduleId }).eq("id", ordenId);
  if (e1) throw e1;
  // trigger en DB sincroniza el schedule
}

export async function crearOrdenDesdePreventivo(s: PreventivoScheduleConPlan): Promise<string> {
  const { data: maxRow } = await supabase.from("ordenes").select("nro_orden").order("nro_orden", { ascending: false }).limit(1).maybeSingle();
  const nro = (maxRow?.nro_orden ?? 1000) + 1;
  const fechaCreacion = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("ordenes").insert({
    nro_orden: nro,
    fecha_creacion: fechaCreacion,
    fecha_limite_realizacion: s.scheduled_date,
    tipo_orden: "Preventivo",
    estado: "Pendiente",
    prioridad: "Media",
    nombre_equipo: s.plan.equipo,
    codigo_equipo: s.plan.equipo_codigo ?? "",
    trabajo_solicitado: s.plan.tarea,
    descripcion_problema: `Preventivo programado: ${s.plan.tarea}${s.plan.frecuencia_texto ? ` (cada ${s.plan.frecuencia_texto})` : ""}`,
    observaciones: s.observaciones ?? "",
    preventivo_schedule_id: s.id,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function importarParseado(parsed: ParsedImport, userId: string) {
  // 1) Upsert planes - we need to dedupe by unique key. We try insert; on conflict select existing.
  const planValues = Array.from(parsed.planes.values()).map((p) => ({
    equipo: p.equipo,
    equipo_codigo: p.equipo_codigo,
    tarea: p.tarea,
    tipo_tarea: p.tipo_tarea,
    frecuencia_texto: p.frecuencia_texto,
    frecuencia_valor: p.frecuencia_valor,
    frecuencia_unidad: p.frecuencia_unidad,
    source_file: parsed.fileName,
    source_sheet: p.source_sheet,
    source_row: p.source_row,
  }));

  let planesCreados = 0;
  let planesActualizados = 0;
  const keyToId = new Map<string, string>();

  // insert in chunks with ignoreDuplicates equivalent: try upsert with onConflict on unique constraint
  for (let i = 0; i < planValues.length; i += 200) {
    const chunk = planValues.slice(i, i + 200);
    const { data, error } = await supabase
      .from("preventivos_planes")
      .upsert(chunk, { onConflict: "equipo,equipo_codigo,tarea,frecuencia_texto,source_sheet", ignoreDuplicates: false })
      .select("id, equipo, equipo_codigo, tarea, frecuencia_texto, source_sheet");
    if (error) throw error;
    for (const row of data ?? []) {
      const key = planKeyOf(row as any);
      keyToId.set(key, (row as any).id);
    }
    planesCreados += data?.length ?? 0;
  }
  // make sure all keys mapped even if some weren't returned
  if (keyToId.size < parsed.planes.size) {
    const { data } = await supabase
      .from("preventivos_planes")
      .select("id, equipo, equipo_codigo, tarea, frecuencia_texto, source_sheet");
    for (const row of data ?? []) {
      const key = planKeyOf(row as any);
      if (parsed.planes.has(key)) keyToId.set(key, (row as any).id);
    }
  }

  // 2) Schedule upsert
  let scheduleCreados = 0;
  let scheduleOmitidos = 0;
  const schedValues = parsed.schedules.map((s) => {
    const pid = keyToId.get(s.planKey);
    if (!pid) {
      scheduleOmitidos++;
      return null;
    }
    return {
      plan_id: pid,
      scheduled_date: s.scheduled_date,
      anio: s.anio,
      mes: s.mes,
      dia: s.dia,
      estado: s.estado,
      source_cell: s.source_cell,
      import_notes: s.import_notes,
    };
  }).filter(Boolean) as any[];

  for (let i = 0; i < schedValues.length; i += 500) {
    const chunk = schedValues.slice(i, i + 500);
    const { error, count } = await supabase
      .from("preventivos_schedule")
      .upsert(chunk, { onConflict: "plan_id,anio,mes,source_cell", ignoreDuplicates: false, count: "exact" });
    if (error) throw error;
    scheduleCreados += count ?? chunk.length;
  }

  // 3) Record import
  const { error: impErr } = await supabase.from("preventivos_imports").insert({
    file_name: parsed.fileName,
    file_hash: parsed.fileHash,
    imported_by: userId,
    anios_detectados: parsed.aniosDetectados,
    hojas_procesadas: parsed.hojasProcesadas,
    planes_creados: planesCreados,
    schedule_creados: scheduleCreados,
    schedule_omitidos: scheduleOmitidos,
    errores: parsed.errores,
    estado: parsed.errores.length ? "completado_con_errores" : "completado",
  });
  if (impErr) throw impErr;

  return { planesCreados, planesActualizados, scheduleCreados, scheduleOmitidos };
}

export function deriveEstado(s: PreventivoSchedule, todayISO: string): EstadoPreventivo {
  return computeStatusBy(s.scheduled_date, s.estado, todayISO);
}

// ---------- Generación anual de preventivos a partir de plantillas ----------

export interface GenerarAnioResultado {
  creados: number;
  omitidos: number;
  planesProcesados: number;
  planesSinFrecuencia: number;
  candidatos: number;
  errores: string[];
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function isoFor(year: number, month1: number, preferredDay: number): string {
  const day = Math.min(Math.max(1, preferredDay), lastDayOfMonth(year, month1));
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Candidato {
  plan_id: string;
  scheduled_date: string;
  anio: number;
  mes: number;
  dia: number;
}

async function planesParaGenerar(): Promise<{ planes: PreventivoPlan[]; sinFrecuencia: number }> {
  const { data, error } = await supabase
    .from("preventivos_planes")
    .select("*")
    .eq("activo", true);
  if (error) throw error;
  const todos = (data ?? []) as unknown as PreventivoPlan[];
  const validos = todos.filter((p) =>
    p.frecuencia_unidad === "meses" &&
    typeof p.frecuencia_valor === "number" &&
    p.frecuencia_valor >= 1 &&
    p.frecuencia_valor <= 12
  );
  return { planes: validos, sinFrecuencia: todos.length - validos.length };
}

function calcularCandidatos(planes: PreventivoPlan[], year: number): Candidato[] {
  const out: Candidato[] = [];
  for (const p of planes) {
    const step = p.frecuencia_valor as number;
    const startMes = Math.min(Math.max(1, (p as any).mes_inicio ?? 1), 12);
    const dia = (p as any).dia_preferido ?? 15;
    for (let m = startMes; m <= 12; m += step) {
      const fecha = isoFor(year, m, dia);
      const realDia = Number(fecha.slice(8, 10));
      out.push({ plan_id: p.id, scheduled_date: fecha, anio: year, mes: m, dia: realDia });
    }
  }
  return out;
}

export async function previewGenerarAnio(year: number): Promise<{ planes: number; planesSinFrecuencia: number; candidatos: number; existentes: number; nuevos: number }> {
  const { planes, sinFrecuencia } = await planesParaGenerar();
  const cand = calcularCandidatos(planes, year);
  if (cand.length === 0) return { planes: planes.length, planesSinFrecuencia: sinFrecuencia, candidatos: 0, existentes: 0, nuevos: 0 };
  const sourceCell = `auto-${year}`;
  const planIds = Array.from(new Set(cand.map((c) => c.plan_id)));
  const { data, error } = await supabase
    .from("preventivos_schedule")
    .select("plan_id, anio, mes, source_cell")
    .eq("anio", year)
    .eq("source_cell", sourceCell)
    .in("plan_id", planIds);
  if (error) throw error;
  const existing = new Set((data ?? []).map((r: any) => `${r.plan_id}|${r.anio}|${r.mes}|${r.source_cell}`));
  let existentes = 0;
  for (const c of cand) {
    if (existing.has(`${c.plan_id}|${c.anio}|${c.mes}|${sourceCell}`)) existentes++;
  }
  return {
    planes: planes.length,
    planesSinFrecuencia: sinFrecuencia,
    candidatos: cand.length,
    existentes,
    nuevos: cand.length - existentes,
  };
}

export async function generarAnio(year: number): Promise<GenerarAnioResultado> {
  const errores: string[] = [];
  const { planes, sinFrecuencia } = await planesParaGenerar();
  const cand = calcularCandidatos(planes, year);
  if (cand.length === 0) {
    return { creados: 0, omitidos: 0, planesProcesados: planes.length, planesSinFrecuencia: sinFrecuencia, candidatos: 0, errores };
  }
  const sourceCell = `auto-${year}`;
  const rows = cand.map((c) => ({
    plan_id: c.plan_id,
    scheduled_date: c.scheduled_date,
    anio: c.anio,
    mes: c.mes,
    dia: c.dia,
    estado: "Programado",
    source_cell: sourceCell,
  }));

  // Detectar existentes ANTES para calcular omitidos con precisión
  const planIds = Array.from(new Set(cand.map((c) => c.plan_id)));
  const { data: existingRows, error: exErr } = await supabase
    .from("preventivos_schedule")
    .select("plan_id, mes")
    .eq("anio", year)
    .eq("source_cell", sourceCell)
    .in("plan_id", planIds);
  if (exErr) throw exErr;
  const existing = new Set((existingRows ?? []).map((r: any) => `${r.plan_id}|${r.mes}`));
  const omitidos = rows.filter((r) => existing.has(`${r.plan_id}|${r.mes}`)).length;

  // Upsert con ignoreDuplicates: idempotente sobre (plan_id, anio, mes, source_cell)
  let creados = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("preventivos_schedule")
      .upsert(chunk, { onConflict: "plan_id,anio,mes,source_cell", ignoreDuplicates: true });
    if (error) {
      errores.push(error.message);
    }
  }
  creados = rows.length - omitidos - errores.length;
  if (creados < 0) creados = 0;

  return {
    creados,
    omitidos,
    planesProcesados: planes.length,
    planesSinFrecuencia: sinFrecuencia,
    candidatos: cand.length,
    errores,
  };
}

