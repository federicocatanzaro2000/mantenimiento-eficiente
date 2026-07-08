import { supabase } from "@/integrations/supabase/client";
import { Orden, Material } from "@/types/orden";

// Map DB row -> Orden (UI)
export function rowToOrden(r: any): Orden {
  return {
    id: r.id,
    nroOrden: r.nro_orden ?? "",
    fechaCreacion: r.fecha_creacion ?? "",
    fechaInicio: r.fecha_inicio ?? "",
    fechaFinalizacion: r.fecha_finalizacion ?? "",
    fechaLimiteRealizacion: r.fecha_limite_realizacion ?? "",
    tecnicoResponsable: r.tecnico_responsable ?? "",
    tecnicosResponsables: Array.isArray(r.tecnicos_responsables)
      ? (r.tecnicos_responsables as string[]).filter((x) => x && String(x).trim() !== "")
      : (r.tecnico_responsable ? [r.tecnico_responsable] : []),
    sector: r.sector ?? "",
    tipoOrden: (r.tipo_orden ?? "") as Orden["tipoOrden"],
    aprobado: !!r.aprobado,
    estado: (r.estado ?? "") as Orden["estado"],
    prioridad: (r.prioridad ?? "") as Orden["prioridad"],
    horasPresupuestadas: r.horas_presupuestadas == null ? "" : Number(r.horas_presupuestadas),
    horasReales: r.horas_reales == null ? "" : Number(r.horas_reales),
    descripcionProblema: r.descripcion_problema ?? "",
    codigoDocumento: r.codigo_documento ?? "",
    codigoEquipo: r.codigo_equipo ?? "",
    nombreEquipo: r.nombre_equipo ?? "",
    solicitante: r.solicitante ?? "",
    trabajoSolicitado: r.trabajo_solicitado ?? "",
    estadoRecepcionEquipo: (r.estado_recepcion_equipo ?? "") as Orden["estadoRecepcionEquipo"],
    observaciones: r.observaciones ?? "",
    sectorLimpioOrdenado: !!r.sector_limpio_ordenado,
    herramientasLimpiasOrdenadas: !!r.herramientas_limpias_ordenadas,
    materialesUtilizados: (r.materiales_utilizados ?? []) as Material[],
    materialesPrevistos: (r.materiales_previstos ?? []) as Material[],

    controlLiberacionCalidad: !!r.control_liberacion_calidad,
    responsableControlCalidad: r.responsable_control_calidad ?? "",
    comentarioCalidad: r.comentario_calidad ?? "",
    elaboro: r.elaboro ?? "",
    reviso: r.reviso ?? "",
    aprobo: r.aprobo ?? "",
    lineStopped: r.line_stopped === null || r.line_stopped === undefined ? null : !!r.line_stopped,
    lineStoppedHours: r.line_stopped_hours == null ? "" : Number(r.line_stopped_hours),
    projectHasEquipment: r.project_has_equipment === null || r.project_has_equipment === undefined ? null : !!r.project_has_equipment,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
    createdBy: r.created_by ?? null,
    updatedBy: r.updated_by ?? null,
  } as Orden;
}

function ordenToRow(o: Orden) {
  return {
    nro_orden: Number(o.nroOrden) || 0,
    fecha_creacion: o.fechaCreacion || null,
    fecha_inicio: o.fechaInicio || null,
    fecha_finalizacion: o.fechaFinalizacion || null,
    fecha_limite_realizacion: o.fechaLimiteRealizacion || null,
    tecnico_responsable: (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
      ? o.tecnicosResponsables.join(", ")
      : o.tecnicoResponsable,
    tecnicos_responsables: (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
      ? o.tecnicosResponsables
      : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []),
    sector: o.sector,
    tipo_orden: o.tipoOrden || null,
    aprobado: o.aprobado,
    estado: o.estado || null,
    prioridad: o.prioridad || null,
    horas_presupuestadas: o.horasPresupuestadas === "" ? null : Number(o.horasPresupuestadas),
    horas_reales: o.horasReales === "" ? null : Number(o.horasReales),
    descripcion_problema: o.descripcionProblema,
    codigo_documento: o.codigoDocumento,
    codigo_equipo: o.codigoEquipo,
    nombre_equipo: o.nombreEquipo,
    solicitante: o.solicitante,
    trabajo_solicitado: o.trabajoSolicitado,
    estado_recepcion_equipo: o.estadoRecepcionEquipo,
    observaciones: o.observaciones,
    sector_limpio_ordenado: o.sectorLimpioOrdenado,
    herramientas_limpias_ordenadas: o.herramientasLimpiasOrdenadas,
    materiales_utilizados: o.materialesUtilizados as any,
    materiales_previstos: (o.materialesPrevistos ?? []) as any,

    control_liberacion_calidad: o.controlLiberacionCalidad,
    responsable_control_calidad: o.responsableControlCalidad,
    comentario_calidad: o.comentarioCalidad ?? "",
    elaboro: o.elaboro,
    reviso: o.reviso,
    aprobo: o.aprobo,
    line_stopped: o.lineStopped === true ? true : o.lineStopped === false ? false : null,
    line_stopped_hours:
      o.lineStopped === true && o.lineStoppedHours !== "" && o.lineStoppedHours !== null
        ? Number(String(o.lineStoppedHours).replace(",", "."))
        : null,
    project_has_equipment: o.projectHasEquipment ?? null,
  };
}

export async function fetchOrdenes(): Promise<Orden[]> {
  const { data, error } = await supabase
    .from("ordenes")
    .select("*")
    .order("nro_orden", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrden);
}

export async function insertOrden(o: Orden): Promise<Orden> {
  const { data, error } = await supabase
    .from("ordenes")
    .insert(ordenToRow(o))
    .select("*")
    .single();
  if (error) throw error;
  return rowToOrden(data);
}

export async function updateOrdenDb(id: string, o: Orden): Promise<Orden> {
  const { data, error } = await supabase
    .from("ordenes")
    .update(ordenToRow(o))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToOrden(data);
}

export async function deleteOrdenDb(id: string): Promise<void> {
  const { error } = await supabase.from("ordenes").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProfilesMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("profiles").select("user_id,nombre");
  if (error) return {};
  const map: Record<string, string> = {};
  (data ?? []).forEach((p: any) => { map[p.user_id] = p.nombre || ""; });
  return map;
}
