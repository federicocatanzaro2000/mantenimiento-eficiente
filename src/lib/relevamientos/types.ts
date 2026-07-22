export type InvolucradoTipo = "equipo" | "linea" | "sector";
export type RelevPrioridad = "Alta" | "Media" | "Baja";
export type RelevEstado = "Pendiente" | "Convertido en OIT" | "Rechazado";

export interface CatalogoInvolucrado {
  id: string;
  nombre: string;
  tipo: InvolucradoTipo;
  codigo: string | null;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Relevamiento {
  id: string;
  numero: string;
  solicitante: string;
  descripcion: string;
  involucrado_id: string | null;
  involucrado_tipo: InvolucradoTipo;
  involucrado_nombre: string;
  prioridad: RelevPrioridad;
  estado: RelevEstado;
  oit_id: string | null;
  motivo_rechazo: string | null;
  created_by: string;
  updated_by: string | null;
  convertido_por: string | null;
  convertido_at: string | null;
  rechazado_por: string | null;
  rechazado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelevAdjunto {
  id: string;
  relevamiento_id: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_at: string;
  active: boolean;
}

export const MAX_RELEV_FILES = 6;
export const MAX_RELEV_SIZE = 25 * 1024 * 1024; // 25MB
export const ALLOWED_RELEV_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf",
];

export const PRIORIDAD_COLORS: Record<RelevPrioridad, string> = {
  Alta: "bg-destructive text-destructive-foreground",
  Media: "bg-amber-500 text-white",
  Baja: "bg-emerald-600 text-white",
};

export const ESTADO_COLORS: Record<RelevEstado, string> = {
  "Pendiente": "bg-amber-500 text-white",
  "Convertido en OIT": "bg-emerald-600 text-white",
  "Rechazado": "bg-muted text-muted-foreground",
};
