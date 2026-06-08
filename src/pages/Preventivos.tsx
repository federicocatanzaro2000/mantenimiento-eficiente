import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { canImportPreventivos, canManagePreventivos, canUpdatePreventivoEstado } from "@/lib/permissions";
import { toast } from "@/hooks/use-toast";
import { EstadoPreventivo, ESTADO_COLOR, PreventivoScheduleConPlan, PreventivoPlan, TIPOS_TAREA, TipoTarea, computeStatusBy } from "@/lib/preventivos/types";
import {
  fetchSchedule, fetchPlanes, updateScheduleEstado, reprogramarSchedule, eliminarSchedule,
  importarParseado, crearOrdenDesdePreventivo, vincularOrden, crearPlanManual, crearScheduleManual,
} from "@/lib/preventivos/api";
import { parseExcel } from "@/lib/preventivos/parser";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CalendarDays, Table2, Grid3x3, FilePlus, RefreshCw, CheckCircle2, XCircle, Eye, Trash2, Link2, AlertTriangle, Clock, CalendarClock, Plus } from "lucide-react";

type Bucket = "vencidos" | "prox7" | "prox30" | "futuros" | "cerrados";
type QuickFilter = "operativo" | "vencidos" | "prox7" | "prox30" | "todos";

function bucketOf(estado: EstadoPreventivo, diasRestantes: number | null): Bucket {
  if (estado === "Completado" || estado === "Cancelado") return "cerrados";
  if (estado === "Vencido") return "vencidos";
  if (diasRestantes === null) return "futuros";
  if (diasRestantes < 0) return "vencidos";
  if (diasRestantes <= 7) return "prox7";
  if (diasRestantes <= 30) return "prox30";
  return "futuros";
}

function DiasBadge({ dias, estado }: { dias: number | null; estado: EstadoPreventivo }) {
  if (estado === "Completado") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3" />OK</span>;
  if (estado === "Cancelado") return <span className="text-xs text-muted-foreground">—</span>;
  if (dias === null) return <span className="text-xs text-muted-foreground">s/fecha</span>;
  if (dias < 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white"><AlertTriangle className="h-3 w-3" />{Math.abs(dias)}d vencido</span>;
  if (dias === 0) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">HOY</span>;
  if (dias <= 7) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-white">{dias}d</span>;
  if (dias <= 30) return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">{dias}d</span>;
  return <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">{dias}d</span>;
}

const BUCKET_INFO: Record<Bucket, { label: string; icon: typeof AlertTriangle; cls: string; rowCls: string }> = {
  vencidos: { label: "VENCIDOS", icon: AlertTriangle, cls: "bg-red-600 text-white", rowCls: "border-l-4 border-red-600 bg-red-50/50" },
  prox7:    { label: "PRÓXIMOS 7 DÍAS", icon: Clock, cls: "bg-amber-500 text-white", rowCls: "border-l-4 border-amber-500 bg-amber-50/40" },
  prox30:   { label: "PRÓXIMOS 30 DÍAS", icon: CalendarClock, cls: "bg-blue-500 text-white", rowCls: "border-l-4 border-blue-300" },
  futuros:  { label: "FUTUROS", icon: CalendarDays, cls: "bg-slate-500 text-white", rowCls: "" },
  cerrados: { label: "COMPLETADOS / CANCELADOS", icon: CheckCircle2, cls: "bg-emerald-600 text-white", rowCls: "opacity-60" },
};

const MES_NOMBRES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const ESTADOS: EstadoPreventivo[] = ["Programado","Próximo","OT creada","En proceso","Completado","Vencido","Reprogramado","Cancelado","Requiere revisión"];

function todayBA(): string {
  // America/Argentina/Buenos_Aires (UTC-3, no DST)
  const d = new Date();
  const ba = new Date(d.getTime() - 3 * 3600_000);
  return ba.toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((+new Date(toISO) - +new Date(fromISO)) / 86400000);
}

interface OrdenLite { id: string; nro_orden: number; nombre_equipo: string | null; estado: string | null; }

export default function Preventivos() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<PreventivoScheduleConPlan[]>([]);
  const [tab, setTab] = useState("tabla");
  const today = todayBA();

  // filters
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("__all");
  const [filtroAnio, setFiltroAnio] = useState<string>("__all");
  const [filtroTipo, setFiltroTipo] = useState<string>("__all");
  const [filtroMes, setFiltroMes] = useState<string>("__all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("operativo");

  // dialogs
  const [openReprog, setOpenReprog] = useState<PreventivoScheduleConPlan | null>(null);
  const [reprogFecha, setReprogFecha] = useState("");
  const [openComplete, setOpenComplete] = useState<PreventivoScheduleConPlan | null>(null);
  const [completeObs, setCompleteObs] = useState("");
  const [openVincular, setOpenVincular] = useState<PreventivoScheduleConPlan | null>(null);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<string>("");
  const [ordenesAbiertas, setOrdenesAbiertas] = useState<OrdenLite[]>([]);
  const [openDetalle, setOpenDetalle] = useState<PreventivoScheduleConPlan | null>(null);

  // Nuevo preventivo manual
  const [openNuevo, setOpenNuevo] = useState(false);
  const [nuevoModo, setNuevoModo] = useState<"nuevo" | "existente">("nuevo");
  const [nuevoPlanId, setNuevoPlanId] = useState<string>("");
  const [nuevoEquipo, setNuevoEquipo] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoTarea, setNuevoTarea] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<TipoTarea | "">("");
  const [nuevoFrec, setNuevoFrec] = useState("");
  const [nuevoFecha, setNuevoFecha] = useState("");
  const [nuevoObs, setNuevoObs] = useState("");
  const [nuevoSaving, setNuevoSaving] = useState(false);
  const [planesList, setPlanesList] = useState<PreventivoPlan[]>([]);
  const [nuevoRepetir, setNuevoRepetir] = useState<number>(1);
  const [nuevoIntervaloMeses, setNuevoIntervaloMeses] = useState<number>(1);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchSchedule();
      setSchedule(data);
    } catch (e) {
      toast({ title: "Error cargando preventivos", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const derivado = useMemo(() => schedule.map((s) => {
    const estadoVisible = computeStatusBy(s.scheduled_date, s.estado, today) as EstadoPreventivo;
    const diasRestantes = s.scheduled_date ? daysBetween(today, s.scheduled_date) : null;
    return { ...s, estadoVisible, diasRestantes, bucket: bucketOf(estadoVisible, diasRestantes) };
  }), [schedule, today]);

  const aniosDisponibles = useMemo(() => {
    const set = new Set(schedule.map((s) => s.anio));
    return Array.from(set).sort();
  }, [schedule]);

  const equiposDisponibles = useMemo(() => {
    const set = new Set(schedule.map((s) => s.plan.equipo));
    return Array.from(set).sort();
  }, [schedule]);

  const tiposDisponibles = useMemo(() => {
    const set = new Set(schedule.map((s) => s.plan.tipo_tarea ?? "Otro"));
    return Array.from(set).sort();
  }, [schedule]);

  const filtrado = useMemo(() => derivado.filter((s) => {
    if (filtroEstado !== "__all" && s.estadoVisible !== filtroEstado) return false;
    if (filtroAnio !== "__all" && String(s.anio) !== filtroAnio) return false;
    if (filtroMes !== "__all" && String(s.mes) !== filtroMes) return false;
    if (filtroTipo !== "__all" && (s.plan.tipo_tarea ?? "Otro") !== filtroTipo) return false;
    if (filtroEquipo) {
      const q = filtroEquipo.toLowerCase();
      if (!s.plan.equipo.toLowerCase().includes(q) && !s.plan.tarea.toLowerCase().includes(q)) return false;
    }
    if (quickFilter === "vencidos" && s.bucket !== "vencidos") return false;
    if (quickFilter === "prox7" && s.bucket !== "prox7" && s.bucket !== "vencidos") return false;
    if (quickFilter === "prox30" && !["vencidos","prox7","prox30"].includes(s.bucket)) return false;
    return true;
  }), [derivado, filtroEstado, filtroAnio, filtroMes, filtroTipo, filtroEquipo, quickFilter]);

  // Agrupar por bucket y ordenar por fecha dentro de cada grupo
  const BUCKET_ORDER: Bucket[] = ["vencidos", "prox7", "prox30", "futuros", "cerrados"];
  const agrupado = useMemo(() => {
    const groups: Record<Bucket, typeof filtrado> = { vencidos: [], prox7: [], prox30: [], futuros: [], cerrados: [] };
    for (const s of filtrado) groups[s.bucket].push(s);
    for (const b of BUCKET_ORDER) {
      groups[b].sort((a, z) => (a.scheduled_date ?? "").localeCompare(z.scheduled_date ?? ""));
    }
    return groups;
  }, [filtrado]);

  const indicadores = useMemo(() => {
    const prox7 = derivado.filter((s) => s.estadoVisible !== "Completado" && s.estadoVisible !== "Cancelado" && s.diasRestantes !== null && s.diasRestantes >= 0 && s.diasRestantes <= 7).length;
    const prox30 = derivado.filter((s) => s.estadoVisible !== "Completado" && s.estadoVisible !== "Cancelado" && s.diasRestantes !== null && s.diasRestantes >= 0 && s.diasRestantes <= 30).length;
    const vencidos = derivado.filter((s) => s.estadoVisible === "Vencido").length;
    const sinOT = derivado.filter((s) => !s.orden_id && s.estadoVisible !== "Completado" && s.estadoVisible !== "Cancelado").length;
    return { prox7, prox30, vencidos, sinOT };
  }, [derivado]);

  // ---- Acciones ----
  const handleCrearOT = async (s: PreventivoScheduleConPlan) => {
    try {
      const id = await crearOrdenDesdePreventivo(s);
      toast({ title: "Orden creada", description: "Se generó la orden de mantenimiento." });
      await refresh();
      navigate(`/orden/${id}`);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const abrirVincular = async (s: PreventivoScheduleConPlan) => {
    setOpenVincular(s);
    setOrdenSeleccionada("");
    const { data } = await supabase
      .from("ordenes")
      .select("id, nro_orden, nombre_equipo, estado")
      .neq("estado", "Cumplido")
      .is("preventivo_schedule_id", null)
      .order("nro_orden", { ascending: false })
      .limit(100);
    setOrdenesAbiertas((data ?? []) as OrdenLite[]);
  };

  const confirmarVincular = async () => {
    if (!openVincular || !ordenSeleccionada) return;
    try {
      await vincularOrden(openVincular.id, ordenSeleccionada);
      toast({ title: "Vinculado", description: "Orden vinculada al preventivo." });
      setOpenVincular(null);
      await refresh();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const confirmarReprog = async () => {
    if (!openReprog || !reprogFecha) return;
    try {
      await reprogramarSchedule(openReprog.id, reprogFecha);
      toast({ title: "Reprogramado" });
      setOpenReprog(null);
      setReprogFecha("");
      await refresh();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const confirmarCompletar = async () => {
    if (!openComplete) return;
    try {
      await updateScheduleEstado(openComplete.id, "Completado", today, completeObs);
      toast({ title: "Completado" });
      setOpenComplete(null);
      setCompleteObs("");
      await refresh();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleEliminar = async (s: PreventivoScheduleConPlan) => {
    if (!confirm(`¿Eliminar preventivo "${s.plan.tarea}" del ${s.scheduled_date}?`)) return;
    try {
      await eliminarSchedule(s.id);
      toast({ title: "Eliminado" });
      await refresh();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleCancelar = async (s: PreventivoScheduleConPlan) => {
    try {
      await updateScheduleEstado(s.id, "Cancelado");
      await refresh();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Mantenimiento Preventivo</h2>
            <p className="text-sm text-muted-foreground">Cronograma anual de preventivos por equipo.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refrescar
            </Button>
            {canManagePreventivos(roles) && (
              <Button size="sm" onClick={async () => {
                setOpenNuevo(true);
                setNuevoModo("nuevo");
                setNuevoEquipo(""); setNuevoCodigo(""); setNuevoTarea(""); setNuevoTipo(""); setNuevoFrec("");
                setNuevoFecha(today); setNuevoObs(""); setNuevoPlanId("");
                setNuevoRepetir(1); setNuevoIntervaloMeses(1);
                try { setPlanesList(await fetchPlanes()); } catch {}
              }}>
                <Plus className="h-4 w-4" /> Nuevo preventivo
              </Button>
            )}
            {canImportPreventivos(roles) && (
              <Button size="sm" variant="outline" onClick={() => setTab("importar")}>
                <Upload className="h-4 w-4" /> Importar Excel
              </Button>
            )}
          </div>
        </div>

        {/* indicadores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Próx. 7 días</div><div className="text-2xl font-bold text-amber-600">{indicadores.prox7}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Próx. 30 días</div><div className="text-2xl font-bold text-blue-600">{indicadores.prox30}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Vencidos</div><div className="text-2xl font-bold text-red-600">{indicadores.vencidos}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Sin OT</div><div className="text-2xl font-bold text-slate-600">{indicadores.sinOT}</div></CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="tabla"><Table2 className="h-4 w-4 mr-1" /> Tabla</TabsTrigger>
            <TabsTrigger value="cronograma"><Grid3x3 className="h-4 w-4 mr-1" /> Cronograma</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarDays className="h-4 w-4 mr-1" /> Calendario</TabsTrigger>
            {canImportPreventivos(roles) && <TabsTrigger value="importar"><Upload className="h-4 w-4 mr-1" /> Importar</TabsTrigger>}
          </TabsList>

          {/* FILTROS */}
          <Card className="mt-3">
            <CardContent className="p-3 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Buscar equipo o tarea</Label>
                <Input value={filtroEquipo} onChange={(e) => setFiltroEquipo(e.target.value)} placeholder="Extrusora, mezcladora..." className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Año</Label>
                <Select value={filtroAnio} onValueChange={setFiltroAnio}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__all">Todos</SelectItem>{aniosDisponibles.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mes</Label>
                <Select value={filtroMes} onValueChange={setFiltroMes}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__all">Todos</SelectItem>{MES_NOMBRES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__all">Todos</SelectItem>{tiposDisponibles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__all">Todos</SelectItem>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* TABLA */}
          <TabsContent value="tabla">
            {/* Quick filters chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                { k: "operativo" as QuickFilter, label: "Vista operativa", cls: "bg-foreground text-background" },
                { k: "vencidos" as QuickFilter, label: `Vencidos (${indicadores.vencidos})`, cls: "bg-red-600 text-white" },
                { k: "prox7" as QuickFilter, label: `Próx. 7 días (${indicadores.prox7})`, cls: "bg-amber-500 text-white" },
                { k: "prox30" as QuickFilter, label: `Próx. 30 días (${indicadores.prox30})`, cls: "bg-blue-500 text-white" },
                { k: "todos" as QuickFilter, label: "Todos", cls: "bg-slate-500 text-white" },
              ]).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setQuickFilter(f.k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${quickFilter === f.k ? f.cls + " border-transparent shadow" : "bg-background text-foreground border-border hover:bg-muted"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 w-28">Fecha</th>
                      <th className="text-left p-2 w-32">Días</th>
                      <th className="text-left p-2">Equipo</th>
                      <th className="text-left p-2">Tarea</th>
                      <th className="text-left p-2 hidden md:table-cell">Tipo</th>
                      <th className="text-left p-2 hidden lg:table-cell">Frec.</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2 w-20">OT</th>
                      <th className="text-right p-2 w-56">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrado.length === 0 && (
                      <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Sin preventivos en esta vista. Probá otro filtro o importá el Excel.</td></tr>
                    )}
                    {(quickFilter === "operativo" ? BUCKET_ORDER : ["__flat__" as const]).map((bk) => {
                      const items = bk === "__flat__" ? filtrado : agrupado[bk];
                      if (bk !== "__flat__" && items.length === 0) return null;
                      const info = bk !== "__flat__" ? BUCKET_INFO[bk] : null;
                      const Icon = info?.icon;
                      return (
                        <Fragment key={bk}>
                          {info && (
                            <tr key={`h-${bk}`}>
                              <td colSpan={9} className="p-0">
                                <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold tracking-wide ${info.cls}`}>
                                  {Icon && <Icon className="h-3.5 w-3.5" />}
                                  {info.label} <span className="opacity-80 font-normal">· {items.length}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {items.map((s) => {
                            const rowCls = quickFilter === "operativo" ? BUCKET_INFO[s.bucket].rowCls : "";
                            return (
                              <tr key={s.id} className={`border-b hover:bg-muted/40 ${rowCls}`}>
                                <td className="p-2 whitespace-nowrap font-mono text-xs">{s.scheduled_date ?? `${s.anio}-${String(s.mes).padStart(2,"0")}`}</td>
                                <td className="p-2"><DiasBadge dias={s.diasRestantes} estado={s.estadoVisible} /></td>
                                <td className="p-2 font-medium">{s.plan.equipo}{s.plan.equipo_codigo ? <span className="text-muted-foreground"> ({s.plan.equipo_codigo})</span> : ""}</td>
                                <td className="p-2">{s.plan.tarea}</td>
                                <td className="p-2 hidden md:table-cell text-xs">{s.plan.tipo_tarea ?? "—"}</td>
                                <td className="p-2 hidden lg:table-cell text-xs">{s.plan.frecuencia_texto ?? "—"}</td>
                                <td className="p-2"><Badge className={ESTADO_COLOR[s.estadoVisible]} variant="secondary">{s.estadoVisible}</Badge></td>
                                <td className="p-2">{s.orden_id ? <button className="text-primary underline text-xs" onClick={() => navigate(`/orden/${s.orden_id}`)}>Ver</button> : <span className="text-xs text-muted-foreground">—</span>}</td>
                                <td className="p-2 text-right">
                                  <div className="inline-flex gap-1 flex-wrap justify-end items-center">
                                    {canManagePreventivos(roles) && !s.orden_id && s.estadoVisible !== "Completado" && s.estadoVisible !== "Cancelado" && (
                                      <Button size="sm" className="h-7 px-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" onClick={() => handleCrearOT(s)}>
                                        <FilePlus className="h-3.5 w-3.5" /> Crear OIT
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-7 px-2" title="Detalle" onClick={() => setOpenDetalle(s)}><Eye className="h-3.5 w-3.5" /></Button>
                                    {canManagePreventivos(roles) && !s.orden_id && (
                                      <Button size="sm" variant="ghost" className="h-7 px-2" title="Vincular a OT" onClick={() => abrirVincular(s)}><Link2 className="h-3.5 w-3.5" /></Button>
                                    )}
                                    {canManagePreventivos(roles) && (
                                      <Button size="sm" variant="ghost" className="h-7 px-2" title="Reprogramar" onClick={() => { setOpenReprog(s); setReprogFecha(s.scheduled_date ?? today); }}><CalendarDays className="h-3.5 w-3.5" /></Button>
                                    )}
                                    {canUpdatePreventivoEstado(roles) && s.estadoVisible !== "Completado" && (
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Marcar completado" onClick={() => { setOpenComplete(s); setCompleteObs(s.observaciones ?? ""); }}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                                    )}
                                    {canManagePreventivos(roles) && s.estadoVisible !== "Cancelado" && s.estadoVisible !== "Completado" && (
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-600" title="Cancelar" onClick={() => handleCancelar(s)}><XCircle className="h-3.5 w-3.5" /></Button>
                                    )}
                                    {canManagePreventivos(roles) && (
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" title="Eliminar" onClick={() => handleEliminar(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* CRONOGRAMA */}
          <TabsContent value="cronograma">
            <CronogramaView items={filtrado} onSelect={setOpenDetalle} />
          </TabsContent>

          {/* CALENDARIO */}
          <TabsContent value="calendario">
            <CalendarioView items={filtrado} onSelect={setOpenDetalle} />
          </TabsContent>

          {/* IMPORTAR */}
          {canImportPreventivos(roles) && (
            <TabsContent value="importar">
              <ImportarView onDone={refresh} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Diálogos */}
      <Dialog open={!!openReprog} onOpenChange={(o) => !o && setOpenReprog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprogramar preventivo</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm"><strong>{openReprog?.plan.equipo}</strong> — {openReprog?.plan.tarea}</div>
            <Label>Nueva fecha</Label>
            <Input type="date" value={reprogFecha} onChange={(e) => setReprogFecha(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReprog(null)}>Cancelar</Button>
            <Button onClick={confirmarReprog}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openComplete} onOpenChange={(o) => !o && setOpenComplete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como completado</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm"><strong>{openComplete?.plan.equipo}</strong> — {openComplete?.plan.tarea}</div>
            <Label>Observaciones</Label>
            <Textarea value={completeObs} onChange={(e) => setCompleteObs(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenComplete(null)}>Cancelar</Button>
            <Button onClick={confirmarCompletar}>Completar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openVincular} onOpenChange={(o) => !o && setOpenVincular(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular a orden existente</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Orden</Label>
            <Select value={ordenSeleccionada} onValueChange={setOrdenSeleccionada}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {ordenesAbiertas.length === 0 && <div className="p-2 text-sm text-muted-foreground">Sin órdenes abiertas disponibles.</div>}
                {ordenesAbiertas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>#{o.nro_orden} — {o.nombre_equipo ?? "s/equipo"} ({o.estado})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVincular(null)}>Cancelar</Button>
            <Button onClick={confirmarVincular} disabled={!ordenSeleccionada}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openDetalle} onOpenChange={(o) => !o && setOpenDetalle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalle del preventivo</DialogTitle></DialogHeader>
          {openDetalle && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Equipo:</span> <strong>{openDetalle.plan.equipo}</strong> {openDetalle.plan.equipo_codigo && `(${openDetalle.plan.equipo_codigo})`}</div>
              <div><span className="text-muted-foreground">Tarea:</span> {openDetalle.plan.tarea}</div>
              <div><span className="text-muted-foreground">Tipo:</span> {openDetalle.plan.tipo_tarea ?? "—"}</div>
              <div><span className="text-muted-foreground">Frecuencia:</span> {openDetalle.plan.frecuencia_texto ?? "—"}</div>
              <div><span className="text-muted-foreground">Fecha programada:</span> {openDetalle.scheduled_date ?? "—"}</div>
              <div><span className="text-muted-foreground">Estado:</span> <Badge className={ESTADO_COLOR[openDetalle.estado as EstadoPreventivo]} variant="secondary">{openDetalle.estado}</Badge></div>
              {openDetalle.fecha_real && <div><span className="text-muted-foreground">Fecha real:</span> {openDetalle.fecha_real}</div>}
              {openDetalle.observaciones && <div><span className="text-muted-foreground">Observaciones:</span> {openDetalle.observaciones}</div>}
              {openDetalle.import_notes && <div className="text-orange-700"><span className="text-muted-foreground">Nota importación:</span> {openDetalle.import_notes}</div>}
              <div className="text-xs text-muted-foreground border-t pt-2">
                Origen: {openDetalle.plan.source_file ?? "—"} / hoja {openDetalle.plan.source_sheet ?? "—"} / fila {openDetalle.plan.source_row ?? "—"} / celda {openDetalle.source_cell ?? "—"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nuevo preventivo manual */}
      <Dialog open={openNuevo} onOpenChange={(o) => !o && setOpenNuevo(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo preventivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setNuevoModo("nuevo")} className={`px-3 py-1.5 rounded text-xs font-semibold border ${nuevoModo === "nuevo" ? "bg-primary text-primary-foreground border-transparent" : "bg-background"}`}>Plan nuevo</button>
              <button type="button" onClick={() => setNuevoModo("existente")} className={`px-3 py-1.5 rounded text-xs font-semibold border ${nuevoModo === "existente" ? "bg-primary text-primary-foreground border-transparent" : "bg-background"}`}>Plan existente</button>
            </div>

            {nuevoModo === "nuevo" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Equipo *</Label><Input value={nuevoEquipo} onChange={(e) => setNuevoEquipo(e.target.value)} placeholder="Extrusora" /></div>
                <div><Label>Código equipo</Label><Input value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} placeholder="EX1" /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={nuevoTipo} onValueChange={(v) => setNuevoTipo(v as TipoTarea)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{TIPOS_TAREA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Tarea *</Label><Input value={nuevoTarea} onChange={(e) => setNuevoTarea(e.target.value)} placeholder="Cambio de aceite hidráulico" /></div>
                <div className="col-span-2"><Label>Frecuencia (texto)</Label><Input value={nuevoFrec} onChange={(e) => setNuevoFrec(e.target.value)} placeholder="6 meses / 6000 hs" /></div>
              </div>
            ) : (
              <div>
                <Label>Plan existente *</Label>
                <Select value={nuevoPlanId} onValueChange={setNuevoPlanId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger>
                  <SelectContent>
                    {planesList.length === 0 && <div className="p-2 text-sm text-muted-foreground">No hay planes. Creá uno nuevo primero.</div>}
                    {planesList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.equipo}{p.equipo_codigo ? ` (${p.equipo_codigo})` : ""} — {p.tarea}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha programada *</Label><Input type="date" value={nuevoFecha} onChange={(e) => setNuevoFecha(e.target.value)} /></div>
            </div>
            <div><Label>Observaciones</Label><Textarea rows={2} value={nuevoObs} onChange={(e) => setNuevoObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNuevo(false)}>Cancelar</Button>
            <Button
              disabled={nuevoSaving || !nuevoFecha || (nuevoModo === "nuevo" ? (!nuevoEquipo.trim() || !nuevoTarea.trim()) : !nuevoPlanId)}
              onClick={async () => {
                setNuevoSaving(true);
                try {
                  let planId = nuevoPlanId;
                  if (nuevoModo === "nuevo") {
                    const freqMatch = nuevoFrec.match(/(\d+)\s*(h|hs|hora|mes|meses)/i);
                    const plan = await crearPlanManual({
                      equipo: nuevoEquipo.trim(),
                      equipo_codigo: nuevoCodigo.trim() || null,
                      tarea: nuevoTarea.trim(),
                      tipo_tarea: (nuevoTipo || null) as TipoTarea | null,
                      frecuencia_texto: nuevoFrec.trim() || null,
                      frecuencia_valor: freqMatch ? Number(freqMatch[1]) : null,
                      frecuencia_unidad: freqMatch ? (/^h/i.test(freqMatch[2]) ? "horas" : "meses") : null,
                      source_file: null,
                      source_sheet: "manual",
                      source_row: null,
                    });
                    planId = plan.id;
                  }
                  await crearScheduleManual({ plan_id: planId, scheduled_date: nuevoFecha, observaciones: nuevoObs });
                  toast({ title: "Preventivo creado" });
                  setOpenNuevo(false);
                  await refresh();
                } catch (e) {
                  toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
                } finally {
                  setNuevoSaving(false);
                }
              }}
            >
              {nuevoSaving ? "Guardando..." : "Crear preventivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ---------- Vista cronograma anual ----------
function CronogramaView({ items, onSelect }: { items: (PreventivoScheduleConPlan & { estadoVisible: EstadoPreventivo })[]; onSelect: (s: PreventivoScheduleConPlan) => void }) {
  // group by equipo+tarea row, columns = months
  const rows = useMemo(() => {
    const map = new Map<string, { equipo: string; codigo: string | null; tarea: string; tipo: string | null; cells: Record<number, typeof items> }>();
    for (const it of items) {
      const key = `${it.plan.equipo}|${it.plan.equipo_codigo ?? ""}|${it.plan.tarea}`;
      if (!map.has(key)) map.set(key, { equipo: it.plan.equipo, codigo: it.plan.equipo_codigo, tarea: it.plan.tarea, tipo: it.plan.tipo_tarea, cells: {} });
      const row = map.get(key)!;
      if (!row.cells[it.mes]) row.cells[it.mes] = [];
      row.cells[it.mes].push(it);
    }
    return Array.from(map.values()).sort((a, b) => a.equipo.localeCompare(b.equipo));
  }, [items]);

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left p-2 border min-w-[220px]">Equipo / Tarea</th>
              {MES_NOMBRES.map((m) => <th key={m} className="p-1 border text-center min-w-[60px]">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Sin datos para mostrar.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                <td className="p-2 border">
                  <div className="font-medium">{r.equipo}{r.codigo && <span className="text-muted-foreground"> ({r.codigo})</span>}</div>
                  <div className="text-muted-foreground text-[11px]">{r.tarea}</div>
                </td>
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <td key={m} className="p-1 border text-center align-top">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {(r.cells[m] ?? []).map((c) => (
                        <button key={c.id} title={`${c.scheduled_date ?? ""} - ${c.estadoVisible}`} onClick={() => onSelect(c)} className={`px-1.5 py-0.5 rounded text-[11px] ${ESTADO_COLOR[c.estadoVisible]}`}>
                          {c.dia ?? "?"}
                        </button>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------- Vista calendario mensual ----------
function CalendarioView({ items, onSelect }: { items: (PreventivoScheduleConPlan & { estadoVisible: EstadoPreventivo; diasRestantes: number | null })[]; onSelect: (s: PreventivoScheduleConPlan) => void }) {
  const today = todayBA();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = first.getUTCDay(); // 0=Sun

  const byDay = useMemo(() => {
    const map: Record<number, typeof items> = {};
    for (const it of items) {
      if (it.anio === year && it.mes === month && it.dia) {
        if (!map[it.dia]) map[it.dia] = [];
        map[it.dia].push(it);
      }
    }
    return map;
  }, [items, year, month]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{MES_NOMBRES[month - 1]} {year}</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(Date.UTC(year, month - 2, 1)); setYear(d.getUTCFullYear()); setMonth(d.getUTCMonth() + 1); }}>‹</Button>
          <Button size="sm" variant="outline" onClick={() => { setYear(Number(today.slice(0, 4))); setMonth(Number(today.slice(5, 7))); }}>Hoy</Button>
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(Date.UTC(year, month, 1)); setYear(d.getUTCFullYear()); setMonth(d.getUTCMonth() + 1); }}>›</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((d) => <div key={d} className="p-1 font-semibold text-center text-muted-foreground">{d}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const events = byDay[d] ?? [];
            const isToday = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}` === today;
            return (
              <div key={d} className={`border rounded p-1 min-h-[80px] ${isToday ? "ring-2 ring-primary" : ""}`}>
                <div className="text-right text-[11px] text-muted-foreground">{d}</div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map((e) => (
                    <button key={e.id} onClick={() => onSelect(e)} className={`w-full text-left px-1 py-0.5 rounded text-[10px] truncate ${ESTADO_COLOR[e.estadoVisible]}`} title={`${e.plan.equipo} - ${e.plan.tarea}`}>
                      {e.plan.equipo_codigo ?? e.plan.equipo.slice(0, 10)}
                    </button>
                  ))}
                  {events.length > 3 && <div className="text-[10px] text-muted-foreground">+{events.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Importar ----------
function ImportarView({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseExcel>> | null>(null);
  const [resultado, setResultado] = useState<{ planesCreados: number; scheduleCreados: number; scheduleOmitidos: number } | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setParsed(null);
    setResultado(null);
    setParsing(true);
    try {
      const p = await parseExcel(f);
      setParsed(p);
    } catch (e) {
      toast({ title: "Error parseando Excel", description: (e as Error).message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const confirmar = async () => {
    if (!parsed || !user) return;
    setImporting(true);
    try {
      const res = await importarParseado(parsed, user.id);
      setResultado(res);
      toast({ title: "Importación completada", description: `${res.scheduleCreados} preventivos creados/actualizados.` });
      onDone();
    } catch (e) {
      toast({ title: "Error en importación", description: (e as Error).message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Importar cronograma preventivo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Archivo .xlsx</Label>
          <Input type="file" accept=".xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
        {parsing && <div className="text-sm text-muted-foreground">Analizando archivo...</div>}
        {parsed && (
          <div className="space-y-2 border rounded p-3 bg-muted/30">
            <div className="font-medium">Resumen del preview</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>Hojas: <strong>{parsed.hojasProcesadas.join(", ") || "—"}</strong></div>
              <div>Años: <strong>{parsed.aniosDetectados.join(", ") || "—"}</strong></div>
              <div>Planes detectados: <strong>{parsed.planes.size}</strong></div>
              <div>Preventivos detectados: <strong>{parsed.schedules.length}</strong></div>
              <div>Requieren revisión: <strong className="text-orange-600">{parsed.schedules.filter((s) => s.estado === "Requiere revisión").length}</strong></div>
              <div>Errores de parseo: <strong className="text-red-600">{parsed.errores.length}</strong></div>
            </div>
            {parsed.errores.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-red-600">Ver errores</summary>
                <ul className="list-disc pl-5">{parsed.errores.map((e, i) => <li key={i}>[{e.sheet}] {e.message}</li>)}</ul>
              </details>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer">Ver primeros 20 preventivos</summary>
              <ul className="list-disc pl-5">
                {parsed.schedules.slice(0, 20).map((s, i) => (
                  <li key={i}>{s.scheduled_date ?? `${s.anio}-${s.mes}`} — {s.planKey.split("|")[0]} — {s.planKey.split("|")[2]}</li>
                ))}
              </ul>
            </details>
            <div className="flex gap-2 pt-2">
              <Button onClick={confirmar} disabled={importing}>{importing ? "Importando..." : "Confirmar importación"}</Button>
              <Button variant="outline" onClick={() => { setParsed(null); setFile(null); }}>Cancelar</Button>
            </div>
          </div>
        )}
        {resultado && (
          <div className="border-2 border-emerald-300 bg-emerald-50 rounded p-3 text-sm">
            <div className="font-semibold text-emerald-800 mb-1">✓ Importación completada</div>
            <div>Planes: {resultado.planesCreados} · Preventivos: {resultado.scheduleCreados} · Omitidos: {resultado.scheduleOmitidos}</div>
          </div>
        )}
        {file && !parsed && !parsing && <div className="text-sm">Archivo seleccionado: {file.name}</div>}
      </CardContent>
    </Card>
  );
}
