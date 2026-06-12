import { supabase } from "@/integrations/supabase/client";

export interface Sector { id: string; name: string; active: boolean; sort_order: number; }
export interface Person {
  id: string; full_name: string; active: boolean;
  can_be_requester: boolean; can_be_technician: boolean;
  can_be_quality_responsible: boolean; can_be_created_by: boolean; can_be_reviewed_by: boolean;
  can_be_approver: boolean;
}
export interface Equipment { id: string; code: string; name: string; active: boolean; }
export type PersonField = "can_be_requester" | "can_be_technician" | "can_be_quality_responsible" | "can_be_created_by" | "can_be_reviewed_by" | "can_be_approver";

export interface OrderType {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  color: string | null;
  description: string | null;
  requires_line_stoppage_question: boolean;
}

// SECTORS
export async function listSectors(activeOnly = false): Promise<Sector[]> {
  let q = supabase.from("sectors").select("*").order("sort_order").order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Sector[];
}
export async function createSector(name: string, sort_order = 0) {
  const { error } = await supabase.from("sectors").insert({ name: name.trim(), sort_order });
  if (error) throw error;
}
export async function updateSector(id: string, patch: Partial<Pick<Sector, "name" | "active" | "sort_order">>) {
  if (patch.name) patch.name = patch.name.trim();
  const { error } = await supabase.from("sectors").update(patch).eq("id", id);
  if (error) throw error;
}

// PEOPLE
export async function listPeople(opts?: { activeOnly?: boolean; field?: PersonField }): Promise<Person[]> {
  let q = supabase.from("people").select("*").order("full_name");
  if (opts?.activeOnly) q = q.eq("active", true);
  if (opts?.field) q = q.eq(opts.field, true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Person[];
}
export async function createPerson(p: Omit<Person, "id">) {
  const { error } = await supabase.from("people").insert({ ...p, full_name: p.full_name.trim() });
  if (error) throw error;
}
export async function updatePerson(id: string, patch: Partial<Omit<Person, "id">>) {
  if (patch.full_name) patch.full_name = patch.full_name.trim();
  const { error } = await supabase.from("people").update(patch).eq("id", id);
  if (error) throw error;
}

// EQUIPMENT
export async function listEquipment(activeOnly = false): Promise<Equipment[]> {
  let q = supabase.from("equipment").select("*").order("name").order("code");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Equipment[];
}
export async function createEquipment(code: string, name: string) {
  const { error } = await supabase.from("equipment").insert({ code: code.trim(), name: name.trim() });
  if (error) throw error;
}
export async function updateEquipment(id: string, patch: Partial<Pick<Equipment, "code" | "name" | "active">>) {
  if (patch.code) patch.code = patch.code.trim();
  if (patch.name) patch.name = patch.name.trim();
  const { error } = await supabase.from("equipment").update(patch).eq("id", id);
  if (error) throw error;
}
