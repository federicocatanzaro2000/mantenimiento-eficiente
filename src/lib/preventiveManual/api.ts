import { supabase } from "@/integrations/supabase/client";
import { PreventiveItem, PreventiveItemInput, PreventiveStatus } from "./types";

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
