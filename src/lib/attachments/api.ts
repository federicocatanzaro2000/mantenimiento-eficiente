import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "work-order-attachments";
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "pdf"];
export const MAX_SIZE = 10 * 1024 * 1024;
export const MAX_PER_OIT = 10;

export interface Attachment {
  id: string;
  workOrderId: string;
  fileName: string;
  originalFileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string | null;
  uploadedAt: string;
}

function sanitize(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);
}

export function validateFile(f: File): string | null {
  const ext = f.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_MIME.includes(f.type) || !ALLOWED_EXT.includes(ext))
    return "Formato no permitido. Solo se permiten imágenes JPG, PNG, WEBP y archivos PDF.";
  if (f.size > MAX_SIZE) return "Archivo demasiado grande. El tamaño máximo permitido es 10 MB.";
  return null;
}

function rowToAttachment(r: any): Attachment {
  return {
    id: r.id,
    workOrderId: r.work_order_id,
    fileName: r.file_name,
    originalFileName: r.original_file_name,
    filePath: r.file_path,
    mimeType: r.mime_type,
    fileSize: Number(r.file_size),
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  };
}

export async function listAttachments(workOrderId: string): Promise<Attachment[]> {
  const { data, error } = await (supabase as any)
    .from("work_order_attachments")
    .select("*")
    .eq("work_order_id", workOrderId)
    .eq("active", true)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToAttachment);
}

export async function fetchAttachmentCounts(): Promise<Record<string, number>> {
  const { data, error } = await (supabase as any)
    .from("work_order_attachments")
    .select("work_order_id")
    .eq("active", true);
  if (error) return {};
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: any) => {
    out[r.work_order_id] = (out[r.work_order_id] ?? 0) + 1;
  });
  return out;
}

export async function uploadAttachment(workOrderId: string, file: File): Promise<Attachment> {
  const err = validateFile(file);
  if (err) throw new Error(err);
  const ext = file.name.split(".").pop()!.toLowerCase();
  const base = sanitize(file.name.replace(/\.[^.]+$/, "")) || "archivo";
  const physical = `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `work-orders/${workOrderId}/${physical}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from("work_order_attachments")
    .insert({
      work_order_id: workOrderId,
      file_name: physical,
      original_file_name: file.name,
      file_path: path,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: userRes?.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return rowToAttachment(data);
}

export async function softDeleteAttachment(att: Attachment): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("work_order_attachments")
    .update({
      active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: userRes?.user?.id ?? null,
    })
    .eq("id", att.id);
  if (error) throw error;
}

export async function getSignedUrl(att: Attachment, download = false): Promise<string> {
  const opts = download ? { download: att.originalFileName } : undefined;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(att.filePath, 300, opts as any);
  if (error) throw error;
  return data.signedUrl;
}
