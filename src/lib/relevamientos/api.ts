import { supabase } from "@/integrations/supabase/client";
import {
  CatalogoInvolucrado, InvolucradoTipo, RelevAdjunto, Relevamiento,
  RelevEstado, RelevPrioridad, ALLOWED_RELEV_MIME, MAX_RELEV_FILES, MAX_RELEV_SIZE,
} from "./types";

export const RELEV_BUCKET = "relevamiento-attachments";

const T = () => (supabase as any);

// ===== Catálogo involucrados =====
export async function listCatalogo(activeOnly = false): Promise<CatalogoInvolucrado[]> {
  let q = T().from("catalogo_involucrados").select("*").order("tipo").order("nombre");
  if (activeOnly) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CatalogoInvolucrado[];
}
export async function createCatalogo(p: Omit<CatalogoInvolucrado, "id" | "created_at" | "updated_at">) {
  const { error } = await T().from("catalogo_involucrados").insert({
    nombre: p.nombre.trim(),
    tipo: p.tipo,
    codigo: p.codigo?.trim() || null,
    descripcion: p.descripcion?.trim() || null,
    activo: p.activo,
  });
  if (error) throw error;
}
export async function updateCatalogo(id: string, patch: Partial<Omit<CatalogoInvolucrado, "id">>) {
  if (patch.nombre !== undefined) patch.nombre = patch.nombre.trim();
  if (patch.codigo !== undefined) patch.codigo = patch.codigo?.trim() || null;
  if (patch.descripcion !== undefined) patch.descripcion = patch.descripcion?.trim() || null;
  const { error } = await T().from("catalogo_involucrados").update(patch).eq("id", id);
  if (error) throw error;
}

// ===== Relevamientos =====
export async function listRelevamientos(): Promise<Relevamiento[]> {
  const { data, error } = await T().from("relevamientos").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Relevamiento[];
}
export async function getRelevamiento(id: string): Promise<Relevamiento | null> {
  const { data, error } = await T().from("relevamientos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Relevamiento) ?? null;
}

export interface NuevoRelevamiento {
  solicitante: string;
  descripcion: string;
  involucrado_id: string | null;
  involucrado_tipo: InvolucradoTipo;
  involucrado_nombre: string;
  prioridad: RelevPrioridad;
}

export async function createRelevamiento(p: NuevoRelevamiento): Promise<Relevamiento> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) throw new Error("Sesión no válida");
  const { data, error } = await T().from("relevamientos").insert({
    solicitante: p.solicitante.trim(),
    descripcion: p.descripcion.trim(),
    involucrado_id: p.involucrado_id,
    involucrado_tipo: p.involucrado_tipo,
    involucrado_nombre: p.involucrado_nombre.trim(),
    prioridad: p.prioridad,
    estado: "Pendiente" as RelevEstado,
    created_by: u.user.id,
  }).select("*").single();
  if (error) throw error;
  return data as Relevamiento;
}

export async function updateRelevamiento(id: string, patch: Partial<Relevamiento>): Promise<Relevamiento> {
  const clean: any = { ...patch };
  delete clean.id; delete clean.numero; delete clean.created_at; delete clean.created_by;
  const { data, error } = await T().from("relevamientos").update(clean).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Relevamiento;
}

export async function rechazarRelevamiento(id: string, motivo: string): Promise<Relevamiento> {
  const { data: u } = await supabase.auth.getUser();
  if (!motivo.trim()) throw new Error("El motivo de rechazo es obligatorio");
  const { data, error } = await T().from("relevamientos").update({
    estado: "Rechazado" as RelevEstado,
    motivo_rechazo: motivo.trim(),
    rechazado_por: u?.user?.id ?? null,
    rechazado_at: new Date().toISOString(),
  }).eq("id", id).eq("estado", "Pendiente").select("*").single();
  if (error) throw error;
  return data as Relevamiento;
}

export async function marcarConvertido(id: string, oitId: string): Promise<Relevamiento> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await T().from("relevamientos").update({
    estado: "Convertido en OIT" as RelevEstado,
    oit_id: oitId,
    convertido_por: u?.user?.id ?? null,
    convertido_at: new Date().toISOString(),
  }).eq("id", id).eq("estado", "Pendiente").select("*").single();
  if (error) throw error;
  return data as Relevamiento;
}

// Get related OIT number for display
export async function getOitNumero(oitId: string): Promise<number | null> {
  const { data } = await T().from("ordenes").select("nro_orden").eq("id", oitId).maybeSingle();
  return (data?.nro_orden as number) ?? null;
}
export async function getOitNumerosMap(oitIds: string[]): Promise<Record<string, number>> {
  if (oitIds.length === 0) return {};
  const { data } = await T().from("ordenes").select("id,nro_orden").in("id", oitIds);
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: any) => { out[r.id] = r.nro_orden; });
  return out;
}

// ===== Adjuntos =====
export function validateRelevFile(f: File): string | null {
  if (!ALLOWED_RELEV_MIME.includes(f.type)) {
    return "Formato no permitido. Solo imágenes, videos o PDF.";
  }
  if (f.size > MAX_RELEV_SIZE) {
    return `El archivo supera el límite de ${Math.round(MAX_RELEV_SIZE / 1024 / 1024)} MB.`;
  }
  return null;
}

function sanitize(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120);
}

export async function listRelevAdjuntos(relevamientoId: string): Promise<RelevAdjunto[]> {
  const { data, error } = await T().from("relevamiento_adjuntos")
    .select("*").eq("relevamiento_id", relevamientoId).eq("active", true)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RelevAdjunto[];
}

export async function uploadRelevAdjunto(relevamientoId: string, file: File): Promise<RelevAdjunto> {
  const err = validateRelevFile(file);
  if (err) throw new Error(err);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const base = sanitize(file.name.replace(/\.[^.]+$/, "")) || "archivo";
  const physical = `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `relevamientos/${relevamientoId}/${physical}`;
  const { error: upErr } = await supabase.storage.from(RELEV_BUCKET).upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (upErr) throw upErr;
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await T().from("relevamiento_adjuntos").insert({
    relevamiento_id: relevamientoId,
    storage_path: path,
    original_file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: u?.user?.id ?? null,
  }).select("*").single();
  if (error) {
    await supabase.storage.from(RELEV_BUCKET).remove([path]);
    throw error;
  }
  return data as RelevAdjunto;
}

export async function deleteRelevAdjunto(a: RelevAdjunto): Promise<void> {
  const { error } = await T().from("relevamiento_adjuntos")
    .update({ active: false }).eq("id", a.id);
  if (error) throw error;
}

export async function getRelevAdjuntoUrl(a: RelevAdjunto, download = false): Promise<string> {
  const opts = download ? { download: a.original_file_name } : undefined;
  const { data, error } = await supabase.storage.from(RELEV_BUCKET)
    .createSignedUrl(a.storage_path, 300, opts as any);
  if (error) throw error;
  return data.signedUrl;
}

export { MAX_RELEV_FILES, MAX_RELEV_SIZE };
