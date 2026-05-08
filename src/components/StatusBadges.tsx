import { Badge } from "@/components/ui/badge";
import { EstadoOrden, Prioridad } from "@/types/orden";
import { cn } from "@/lib/utils";

export function EstadoBadge({ estado }: { estado: EstadoOrden | "" }) {
  if (!estado) return <span className="text-muted-foreground">—</span>;
  const cls =
    estado === "Cumplido"
      ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]"
      : estado === "Pendiente"
      ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]"
      : "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))] hover:bg-[hsl(var(--info))]";
  return <Badge className={cn("font-medium", cls)}>{estado}</Badge>;
}

export function PrioridadBadge({ prioridad }: { prioridad: Prioridad | "" }) {
  if (!prioridad) return <span className="text-muted-foreground">—</span>;
  const cls =
    prioridad === "Alta"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive"
      : prioridad === "Media"
      ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]"
      : "bg-muted text-muted-foreground hover:bg-muted border border-border";
  return <Badge className={cn("font-medium", cls)}>{prioridad}</Badge>;
}

export function AprobadoBadge({ aprobado }: { aprobado: boolean }) {
  return aprobado ? (
    <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]">
      Aprobado
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground border-border">
      No aprobado
    </Badge>
  );
}

export function CalidadBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]">SI</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">NO</Badge>
  );
}
