import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FileText, XCircle, Loader2 } from "lucide-react";
import { getRelevamiento, getOitNumero, rechazarRelevamiento } from "@/lib/relevamientos/api";
import { fetchProfilesMap } from "@/lib/ordenesApi";
import { Relevamiento, PRIORIDAD_COLORS, ESTADO_COLORS, InvolucradoTipo } from "@/lib/relevamientos/types";
import { RelevAdjuntos } from "@/components/relevamientos/RelevAdjuntos";
import { useAuth } from "@/hooks/useAuth";
import { canCreateOrden } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<InvolucradoTipo, string> = { equipo: "Equipo", linea: "Línea", sector: "Sector" };

export default function RelevamientoDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, roles } = useAuth();
  const [r, setR] = useState<Relevamiento | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [oitNro, setOitNro] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const [rel, profs] = await Promise.all([getRelevamiento(id), fetchProfilesMap()]);
      setR(rel); setProfiles(profs);
      if (rel?.oit_id) setOitNro(await getOitNumero(rel.oit_id));
    } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!r) return <AppLayout><div className="text-center py-10 text-muted-foreground">Cargando...</div></AppLayout>;

  const canGestionar = canCreateOrden(roles);
  const esOwner = user?.id === r.created_by;
  const canEditAdj = (esOwner && r.estado === "Pendiente") || canGestionar;
  const canDeleteAdj = canEditAdj;

  const generarOIT = () => {
    if (r.estado !== "Pendiente" || r.oit_id) {
      toast.error("Este relevamiento ya fue convertido en una OIT."); return;
    }
    // Prefill via query params → OrdenForm lo consumirá
    const params = new URLSearchParams({
      relevamiento_id: r.id,
      solicitante: r.solicitante,
      descripcion: r.descripcion,
      prioridad: r.prioridad,
    });
    if (r.involucrado_tipo === "equipo") {
      params.set("involucrado_equipo", r.involucrado_nombre);
    } else {
      // línea o sector → mapea a sector
      params.set("sector", r.involucrado_nombre);
      params.set("sin_equipo", "1");
    }
    nav(`/orden/nueva?${params.toString()}`);
  };

  const rechazar = async () => {
    if (!motivo.trim()) { toast.error("El motivo es obligatorio."); return; }
    setBusy(true);
    try {
      await rechazarRelevamiento(r.id, motivo);
      toast.success("El relevamiento fue rechazado.");
      setRejectOpen(false); setMotivo("");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => nav("/relevamientos")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            <h1 className="text-xl font-semibold">{r.numero}</h1>
            <Badge className={cn(ESTADO_COLORS[r.estado], "border-transparent")}>{r.estado}</Badge>
            <Badge className={cn(PRIORIDAD_COLORS[r.prioridad], "border-transparent")}>{r.prioridad}</Badge>
          </div>
          <div className="flex gap-2">
            {r.estado === "Pendiente" && canGestionar && (
              <>
                <Button onClick={generarOIT} className="gap-1">
                  <FileText className="h-4 w-4" /> Generar OIT
                </Button>
                <Button variant="outline" onClick={() => setRejectOpen(true)} className="gap-1">
                  <XCircle className="h-4 w-4" /> Rechazar
                </Button>
              </>
            )}
            {r.oit_id && oitNro && (
              <Link to={`/orden/${r.oit_id}`}>
                <Button variant="secondary" className="gap-1">
                  Ver OIT #{oitNro} <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 space-y-3">
          <Row label="Fecha y hora">{new Date(r.created_at).toLocaleString("es-AR")}</Row>
          <Row label="Solicitante">{r.solicitante}</Row>
          <Row label="Cargado por">{profiles[r.created_by] || "—"}</Row>
          <Row label={`${TIPO_LABEL[r.involucrado_tipo]} involucrado`}>{r.involucrado_nombre}</Row>
          <Row label="Descripción"><div className="whitespace-pre-wrap">{r.descripcion}</div></Row>
          {r.estado === "Rechazado" && (
            <div className="border-l-4 border-destructive pl-3 py-2 bg-destructive/5 rounded">
              <div className="text-xs text-muted-foreground">Motivo del rechazo</div>
              <div className="text-sm whitespace-pre-wrap">{r.motivo_rechazo}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {profiles[r.rechazado_por || ""] || ""} · {r.rechazado_at ? new Date(r.rechazado_at).toLocaleString("es-AR") : ""}
              </div>
            </div>
          )}
          {r.estado === "Convertido en OIT" && (
            <div className="border-l-4 border-emerald-600 pl-3 py-2 bg-emerald-500/5 rounded">
              <div className="text-xs text-muted-foreground">Convertido en OIT</div>
              <div className="text-sm">
                {oitNro ? `#${oitNro}` : "—"} por {profiles[r.convertido_por || ""] || "—"} · {r.convertido_at ? new Date(r.convertido_at).toLocaleString("es-AR") : ""}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-md p-4">
          <h3 className="text-sm font-semibold mb-3">Archivos adjuntos</h3>
          <RelevAdjuntos relevamientoId={r.id} canEdit={canEditAdj} canDelete={canDeleteAdj} />
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar relevamiento</DialogTitle>
            <DialogDescription>Indicá el motivo del rechazo. Esta acción no elimina el registro.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo del rechazo (obligatorio)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={rechazar} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-3 text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
