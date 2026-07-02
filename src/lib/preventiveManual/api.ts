import { supabase } from "@/integrations/supabase/client";
import { PreventiveItem, PreventiveItemInput, PreventiveStatus, RecurrenceInput } from "./types";
import { generateOccurrences, horizonISO, RecurrenceRule } from "./recurrence";

export interface PreventiveFilters {
  year?: number | null;
  month?: number | null;
  equipmentCode?: string | null;
  equipmentName?: string | null;
  type?: string | null;
  status?: string | null;
  withOIT?: "with" | "without" | null;
  search?: string | null;
  activeOnly?: boolean;
}

export async function listPreventives(f: PreventiveFilters = {}): Promise<PreventiveItem[]> {
  let q = supabase.from("preventive_manual_items").select("*").order("scheduled_date", { ascending: true });
  if (f.activeOnly !== false) q = q.eq("active", true);
  if (f.year) q = q.eq("scheduled_year", f.year);
  if (f.month) q = q.eq("scheduled_month", f.month);
  if (f.equipmentCode) q = q.ilike("equipment_code_snapshot", f.equipmentCode);
  if (f.equipmentName) q = q.ilike("equipment_name_snapshot", `%${f.equipmentName}%`);
  if (f.type) q = q.eq("preventive_type", f.type);
  if (f.status && f.status !== "Vencido") q = q.eq("status", f.status as PreventiveStatus);
  if (f.withOIT === "with") q = q.not("work_order_id", "is", null);
  if (f.withOIT === "without") q = q.is("work_order_id", null);
  if (f.search) q = q.ilike("task_name", `%${f.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PreventiveItem[];
}

export async function distinctYears(): Promise<number[]> {
  const { data, error } = await supabase
    .from("preventive_manual_items")
    .select("scheduled_year")
    .eq("active", true);
  if (error) throw error;
  const set = new Set<number>();
  (data ?? []).forEach((r: any) => set.add(r.scheduled_year));
  return Array.from(set).sort((a, b) => b - a);
}

export async function createPreventive(input: PreventiveItemInput): Promise<PreventiveItem> {
  const { data, error } = await supabase
    .from("preventive_manual_items")
    .insert({
      scheduled_date: input.scheduled_date,
      scheduled_year: Number(input.scheduled_date.slice(0, 4)),
      scheduled_month: Number(input.scheduled_date.slice(5, 7)),
      scheduled_day: Number(input.scheduled_date.slice(8, 10)),
      equipment_id: input.equipment_id ?? null,
      equipment_code_snapshot: input.equipment_code_snapshot,
      equipment_name_snapshot: input.equipment_name_snapshot,
      task_name: input.task_name,
      preventive_type: input.preventive_type,
      frequency_label: input.frequency_label ?? null,
      status: input.status ?? "Programado",
      responsible_id: input.responsible_id ?? null,
      estimated_hours: input.estimated_hours ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      materiales_previstos: (input.materiales_previstos ?? []) as any,

    })
    .select()
    .single();
  if (error) throw error;
  return data as PreventiveItem;
}

export async function updatePreventive(id: string, patch: Partial<PreventiveItemInput & { active: boolean; status: PreventiveStatus; work_order_id: string | null }>): Promise<void> {
  const p: any = { ...patch };
  if (patch.scheduled_date) {
    p.scheduled_year = Number(patch.scheduled_date.slice(0, 4));
    p.scheduled_month = Number(patch.scheduled_date.slice(5, 7));
    p.scheduled_day = Number(patch.scheduled_date.slice(8, 10));
  }
  const { error } = await supabase.from("preventive_manual_items").update(p).eq("id", id);
  if (error) throw error;
}

export async function softDeletePreventive(id: string): Promise<void> {
  const { error } = await supabase.from("preventive_manual_items").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export async function markRealizado(id: string): Promise<void> {
  await updatePreventive(id, { status: "Realizado" });
}
export async function cancelar(id: string): Promise<void> {
  await updatePreventive(id, { status: "Cancelado" });
}

export async function bulkUpsertPreventives(items: PreventiveItemInput[]): Promise<{ inserted: number; skipped: number }> {
  if (items.length === 0) return { inserted: 0, skipped: 0 };
  const rows = items.map((input) => ({
    scheduled_date: input.scheduled_date,
    scheduled_year: Number(input.scheduled_date.slice(0, 4)),
    scheduled_month: Number(input.scheduled_date.slice(5, 7)),
    scheduled_day: Number(input.scheduled_date.slice(8, 10)),
    equipment_id: input.equipment_id ?? null,
    equipment_code_snapshot: input.equipment_code_snapshot,
    equipment_name_snapshot: input.equipment_name_snapshot,
    task_name: input.task_name,
    preventive_type: input.preventive_type,
    frequency_label: input.frequency_label ?? null,
    status: input.status ?? "Programado",
    notes: input.notes ?? null,
    source: input.source ?? "excel_import",
  }));
  let inserted = 0;
  let skipped = 0;
  // Insert one-by-one to count duplicates; chunk for performance
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await supabase
      .from("preventive_manual_items")
      .insert(chunk)
      .select("id");
    if (error) {
      // fallback: insert one by one
      for (const r of chunk) {
        const { error: e2 } = await supabase.from("preventive_manual_items").insert(r);
        if (e2) skipped++;
        else inserted++;
      }
    } else {
      inserted += data?.length ?? 0;
    }
  }
  return { inserted, skipped };
}

// Crear OIT desde preventivo
export async function createOITFromPreventivo(item: PreventiveItem): Promise<string> {
  const { data: maxRow } = await supabase.from("ordenes").select("nro_orden").order("nro_orden", { ascending: false }).limit(1).maybeSingle();
  const nro = (maxRow?.nro_orden ?? 1000) + 1;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("ordenes").insert({
    nro_orden: nro,
    fecha_creacion: today,
    fecha_limite_realizacion: item.scheduled_date,
    tipo_orden: "Preventivo",
    estado: "Pendiente",
    prioridad: "Media",
    nombre_equipo: item.equipment_name_snapshot,
    codigo_equipo: item.equipment_code_snapshot,
    trabajo_solicitado: item.task_name,
    descripcion_problema: `Preventivo: ${item.task_name}${item.frequency_label ? ` (${item.frequency_label})` : ""}`,
    observaciones: item.notes ?? "",
  }).select("id").single();
  if (error) throw error;
  const ordenId = data.id as string;
  await updatePreventive(item.id, { work_order_id: ordenId, status: "Con OIT" });
  return ordenId;
}

// Duplicar año
export async function duplicateYear(params: { from: number; to: number; mode: "fechas" | "estructura" | "solo_equipos" }): Promise<{ inserted: number; skipped: number }> {
  const source = await listPreventives({ year: params.from });
  if (source.length === 0) return { inserted: 0, skipped: 0 };
  const diff = params.to - params.from;
  const seen = new Set<string>();
  const inputs: PreventiveItemInput[] = [];
  for (const s of source) {
    if (params.mode === "solo_equipos") {
      // only one entry per equipment+task
      const k = `${s.equipment_code_snapshot}|${s.task_name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      inputs.push({
        scheduled_date: `${params.to}-01-15`,
        equipment_id: s.equipment_id,
        equipment_code_snapshot: s.equipment_code_snapshot,
        equipment_name_snapshot: s.equipment_name_snapshot,
        task_name: s.task_name,
        preventive_type: s.preventive_type,
        frequency_label: s.frequency_label,
        source: "duplicated_year",
      });
    } else if (params.mode === "estructura") {
      const k = `${s.equipment_code_snapshot}|${s.task_name}|${s.scheduled_month}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const lastDay = new Date(params.to, s.scheduled_month, 0).getDate();
      const d = Math.min(s.scheduled_day, lastDay);
      inputs.push({
        scheduled_date: `${params.to}-${String(s.scheduled_month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        equipment_id: s.equipment_id,
        equipment_code_snapshot: s.equipment_code_snapshot,
        equipment_name_snapshot: s.equipment_name_snapshot,
        task_name: s.task_name,
        preventive_type: s.preventive_type,
        frequency_label: s.frequency_label,
        source: "duplicated_year",
      });
    } else {
      const d = new Date(s.scheduled_date);
      d.setFullYear(d.getFullYear() + diff);
      const iso = d.toISOString().slice(0, 10);
      inputs.push({
        scheduled_date: iso,
        equipment_id: s.equipment_id,
        equipment_code_snapshot: s.equipment_code_snapshot,
        equipment_name_snapshot: s.equipment_name_snapshot,
        task_name: s.task_name,
        preventive_type: s.preventive_type,
        frequency_label: s.frequency_label,
        source: "duplicated_year",
      });
    }
  }
  return bulkUpsertPreventives(inputs);
}

// ============================================================
// RECURRENCIA
// ============================================================

function buildOccurrenceRow(parent: PreventiveItem, dateISO: string) {
  return {
    scheduled_date: dateISO,
    scheduled_year: Number(dateISO.slice(0, 4)),
    scheduled_month: Number(dateISO.slice(5, 7)),
    scheduled_day: Number(dateISO.slice(8, 10)),
    equipment_id: parent.equipment_id,
    equipment_code_snapshot: parent.equipment_code_snapshot,
    equipment_name_snapshot: parent.equipment_name_snapshot,
    task_name: parent.task_name,
    preventive_type: parent.preventive_type,
    frequency_label: parent.frequency_label,
    status: "Programado" as PreventiveStatus,
    responsible_id: parent.responsible_id,
    estimated_hours: parent.estimated_hours,
    notes: parent.notes,
    source: "manual" as const,
    recurrence_parent_id: parent.id,
    is_recurrence_parent: false,
    repeat_enabled: false,
  };
}

async function insertOccurrencesIgnoringDuplicates(parent: PreventiveItem, dates: string[]): Promise<number> {
  let inserted = 0;
  for (const iso of dates) {
    const { error } = await supabase
      .from("preventive_manual_items")
      .insert(buildOccurrenceRow(parent, iso));
    if (!error) inserted++;
    // Conflicto contra el índice único = duplicado esperado → ignorar
  }
  return inserted;
}

/**
 * Crea un preventivo. Si recurrence.repeat_enabled, lo marca como padre
 * y genera ocurrencias futuras hasta hoy+24 meses (o hasta el fin de la regla).
 */
export async function createPreventiveWithRecurrence(
  input: PreventiveItemInput,
  recurrence: RecurrenceInput,
): Promise<PreventiveItem> {
  const parentRow: any = {
    scheduled_date: input.scheduled_date,
    scheduled_year: Number(input.scheduled_date.slice(0, 4)),
    scheduled_month: Number(input.scheduled_date.slice(5, 7)),
    scheduled_day: Number(input.scheduled_date.slice(8, 10)),
    equipment_id: input.equipment_id ?? null,
    equipment_code_snapshot: input.equipment_code_snapshot,
    equipment_name_snapshot: input.equipment_name_snapshot,
    task_name: input.task_name,
    preventive_type: input.preventive_type,
    frequency_label: input.frequency_label ?? null,
    status: input.status ?? "Programado",
    responsible_id: input.responsible_id ?? null,
    estimated_hours: input.estimated_hours ?? null,
    notes: input.notes ?? null,
    source: input.source ?? "manual",
    repeat_enabled: !!recurrence.repeat_enabled,
    is_recurrence_parent: !!recurrence.repeat_enabled,
    repeat_every: recurrence.repeat_enabled ? recurrence.repeat_every ?? null : null,
    repeat_unit: recurrence.repeat_enabled ? recurrence.repeat_unit ?? null : null,
    repeat_end_mode: recurrence.repeat_enabled ? recurrence.repeat_end_mode ?? "never" : null,
    repeat_end_date: recurrence.repeat_enabled ? recurrence.repeat_end_date ?? null : null,
    repeat_count: recurrence.repeat_enabled ? recurrence.repeat_count ?? null : null,
  };
  const { data, error } = await supabase
    .from("preventive_manual_items")
    .insert(parentRow)
    .select()
    .single();
  if (error) throw error;
  const parent = data as PreventiveItem;

  if (recurrence.repeat_enabled && recurrence.repeat_every && recurrence.repeat_unit) {
    // El padre queda como primera ocurrencia y se referencia a sí mismo
    await supabase
      .from("preventive_manual_items")
      .update({ recurrence_parent_id: parent.id })
      .eq("id", parent.id);
    const rule: RecurrenceRule = {
      every: recurrence.repeat_every,
      unit: recurrence.repeat_unit,
      endMode: recurrence.repeat_end_mode ?? "never",
      endDate: recurrence.repeat_end_date ?? null,
      count: recurrence.repeat_count ?? null,
    };
    const dates = generateOccurrences(input.scheduled_date, rule, horizonISO(24));
    await insertOccurrencesIgnoringDuplicates({ ...parent, recurrence_parent_id: parent.id }, dates);
  }
  return parent;
}

/**
 * Edita toda la serie: actualiza los campos en el padre y replica el patch a las
 * ocurrencias futuras NO ejecutadas y SIN OIT. Si cambió la regla de recurrencia,
 * borra (soft) ocurrencias futuras pendientes y regenera.
 */
export async function updateSeries(
  parentId: string,
  patch: Partial<PreventiveItemInput>,
  recurrence?: RecurrenceInput,
): Promise<void> {
  const { data: parentData, error: pErr } = await supabase
    .from("preventive_manual_items")
    .select("*")
    .eq("id", parentId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!parentData) throw new Error("Preventivo padre no encontrado");
  const parent = parentData as PreventiveItem;

  const parentPatch: any = { ...patch };
  if (patch.scheduled_date) {
    parentPatch.scheduled_year = Number(patch.scheduled_date.slice(0, 4));
    parentPatch.scheduled_month = Number(patch.scheduled_date.slice(5, 7));
    parentPatch.scheduled_day = Number(patch.scheduled_date.slice(8, 10));
  }

  let ruleChanged = false;
  if (recurrence) {
    parentPatch.repeat_enabled = !!recurrence.repeat_enabled;
    parentPatch.is_recurrence_parent = !!recurrence.repeat_enabled;
    parentPatch.repeat_every = recurrence.repeat_enabled ? recurrence.repeat_every ?? null : null;
    parentPatch.repeat_unit = recurrence.repeat_enabled ? recurrence.repeat_unit ?? null : null;
    parentPatch.repeat_end_mode = recurrence.repeat_enabled ? recurrence.repeat_end_mode ?? "never" : null;
    parentPatch.repeat_end_date = recurrence.repeat_enabled ? recurrence.repeat_end_date ?? null : null;
    parentPatch.repeat_count = recurrence.repeat_enabled ? recurrence.repeat_count ?? null : null;
    ruleChanged =
      parent.repeat_enabled !== parentPatch.repeat_enabled ||
      parent.repeat_every !== parentPatch.repeat_every ||
      parent.repeat_unit !== parentPatch.repeat_unit ||
      parent.repeat_end_mode !== parentPatch.repeat_end_mode ||
      parent.repeat_end_date !== parentPatch.repeat_end_date ||
      parent.repeat_count !== parentPatch.repeat_count ||
      (!!patch.scheduled_date && patch.scheduled_date !== parent.scheduled_date);
  }

  const { error: uErr } = await supabase
    .from("preventive_manual_items")
    .update(parentPatch)
    .eq("id", parentId);
  if (uErr) throw uErr;

  // Replicar a ocurrencias futuras pendientes (no ejecutadas y sin OIT)
  const todayISO = new Date().toISOString().slice(0, 10);
  const childPatch: any = {};
  const replicateKeys: (keyof PreventiveItemInput)[] = [
    "equipment_id",
    "equipment_code_snapshot",
    "equipment_name_snapshot",
    "task_name",
    "preventive_type",
    "frequency_label",
    "responsible_id",
    "estimated_hours",
    "notes",
  ];
  for (const k of replicateKeys) {
    if (patch[k] !== undefined) (childPatch as any)[k] = (patch as any)[k];
  }
  if (Object.keys(childPatch).length > 0) {
    await supabase
      .from("preventive_manual_items")
      .update(childPatch)
      .eq("recurrence_parent_id", parentId)
      .neq("id", parentId)
      .eq("active", true)
      .is("work_order_id", null)
      .not("status", "in", "(Realizado,Cancelado)")
      .gte("scheduled_date", todayISO);
  }

  if (ruleChanged) {
    // Soft-delete de ocurrencias futuras pendientes y regeneración
    await supabase
      .from("preventive_manual_items")
      .update({ active: false })
      .eq("recurrence_parent_id", parentId)
      .neq("id", parentId)
      .is("work_order_id", null)
      .not("status", "in", "(Realizado,Cancelado)")
      .gte("scheduled_date", todayISO);

    const newParent: PreventiveItem = { ...parent, ...parentPatch, id: parentId } as PreventiveItem;
    if (newParent.repeat_enabled && newParent.repeat_every && newParent.repeat_unit) {
      const rule: RecurrenceRule = {
        every: newParent.repeat_every,
        unit: newParent.repeat_unit,
        endMode: newParent.repeat_end_mode ?? "never",
        endDate: newParent.repeat_end_date,
        count: newParent.repeat_count,
      };
      const dates = generateOccurrences(newParent.scheduled_date, rule, horizonISO(24));
      await insertOccurrencesIgnoringDuplicates(newParent, dates);
    }
  }
}

/** Cancela todas las ocurrencias futuras pendientes de una serie. */
export async function cancelSeriesFuture(parentId: string): Promise<void> {
  const todayISO = new Date().toISOString().slice(0, 10);
  await supabase
    .from("preventive_manual_items")
    .update({ status: "Cancelado" })
    .eq("recurrence_parent_id", parentId)
    .is("work_order_id", null)
    .not("status", "in", "(Realizado,Cancelado)")
    .gte("scheduled_date", todayISO);
}

/**
 * Asegura que cada serie activa tenga ocurrencias hasta hoy+24 meses.
 * Sirve como "top-up" al abrir la página de preventivos.
 */
export async function topUpSeriesHorizon(): Promise<{ generated: number }> {
  const { data, error } = await supabase
    .from("preventive_manual_items")
    .select("*")
    .eq("is_recurrence_parent", true)
    .eq("repeat_enabled", true)
    .eq("active", true);
  if (error) throw error;
  const parents = (data ?? []) as PreventiveItem[];
  if (parents.length === 0) return { generated: 0 };
  const horizon = horizonISO(24);
  let total = 0;
  for (const parent of parents) {
    if (!parent.repeat_every || !parent.repeat_unit) continue;
    const rule: RecurrenceRule = {
      every: parent.repeat_every,
      unit: parent.repeat_unit,
      endMode: parent.repeat_end_mode ?? "never",
      endDate: parent.repeat_end_date,
      count: parent.repeat_count,
    };
    const dates = generateOccurrences(parent.scheduled_date, rule, horizon);
    if (dates.length === 0) continue;
    total += await insertOccurrencesIgnoringDuplicates(parent, dates);
  }
  return { generated: total };
}
