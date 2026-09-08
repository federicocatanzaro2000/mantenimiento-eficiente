import { Orden } from "@/types/orden";

export const EDILICIO_TIPO = "EDILICIO";

export function isEdilicio(o: Orden): boolean {
  return String(o.tipoOrden ?? "").trim().toUpperCase() === EDILICIO_TIPO;
}

/** Fecha prevista de ejecución: fecha límite de realización; fallback a fecha de inicio. Nunca la de creación. */
export function ediScheduledDate(o: Orden): string {
  return o.fechaLimiteRealizacion || o.fechaInicio || "";
}

export type EdilicioEstado = "Cumplido" | "En proceso" | "Pendiente" | "Vencida" | "Sin estado";

export function isCerrada(o: Orden): boolean {
  return o.estado === "Cumplido";
}

/** Estado visual: Cumplido > Vencida (abierta con fecha pasada) > estado real. */
export function edilicioEstado(o: Orden, todayISO: string): EdilicioEstado {
  if (isCerrada(o)) return "Cumplido";
  const d = ediScheduledDate(o);
  if (d && d < todayISO) return "Vencida";
  if (o.estado === "En proceso") return "En proceso";
  if (o.estado === "Pendiente") return "Pendiente";
  return "Sin estado";
}

export const EDILICIO_STATUS_COLORS: Record<EdilicioEstado, string> = {
  Cumplido: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent",
  "En proceso": "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))] border-transparent",
  Pendiente: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent",
  Vencida: "bg-destructive text-destructive-foreground border-transparent",
  "Sin estado": "bg-muted text-muted-foreground border-border",
};
