import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { EstadoBadge, PrioridadBadge } from "@/components/StatusBadges";
import { EdiliciosCalendar } from "@/components/edilicios/EdiliciosCalendar";
import { useOrdenesStore } from "@/store/ordenesStore";
import { useAuth } from "@/hooks/useAuth";
import { canCreateOrden } from "@/lib/permissions";
import { Equipment, Person, Sector, listEquipment, listPeople, listSectors } from "@/lib/catalogos/api";
import { todayISOArgentina } from "@/lib/preventiveManual/types";
import { Orden } from "@/types/orden";
import { isEdilicio, ediScheduledDate, edilicioEstado, EDILICIO_STATUS_COLORS } from "@/lib/edilicios/status";
import { Plus, RefreshCw, CalendarClock, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(d: string) {
  return d ? d.split("-").reverse().join("/") : "—";
}
function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return isoOf(dt);
}

type SortKey = "fecha" | "nro" | "sector" | "equipo" | "prioridad" | "estado";

export default function EdiliciosPage() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { ordenes, loaded, loading, loadAll } = useOrdenesStore();
  const todayISO = todayISOArgentina();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const [year, setYear] = useState(Number(todayISO.slice(0, 4)));
  const [month, setMonth] = useState(Number(todayISO.slice(5, 7)));
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO));
  const [calMode, setCalMode] = useState<"mes" | "semana">("mes");
  const [view, setView] = useState<"calendario" | "listado">("calendario");

  const [fSector, setFSector] = useState("");
  const [fEquipo, setFEquipo] = useState("");
  const [fResp, setFResp] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fPrioridad, setFPrioridad] = useState("");

  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [noDateOpen, setNoDateOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);
  useEffect(() => {
    listSectors(true).then(setSectors).catch(() => {});
    listPeople({ activeOnly: true }).then(setPeople).catch(() => {});
    listEquipment(true).then(setEquipment).catch(() => {});
  }, []);

  const base = useMemo(() => ordenes.filter(isEdilicio), [ordenes]);

  const filtered = useMemo(() => base.filter((o) => {
    if (fSector && o.sector !== fSector) return false;
    if (fEquipo && o.codigoEquipo !== fEquipo) return false;
    if (fResp) {
      const list = (o.tecnicosResponsables && o.tecnicosResponsables.length > 0) ? o.tecnicosResponsables : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []);
      if (!list.some((t) => t.trim().toLowerCase() === fResp.trim().toLowerCase())) return false;
    }
    if (fEstado && o.estado !== fEstado) return false;
    if (fPrioridad && o.prioridad !== fPrioridad) return false;
    return true;
  }), [base, fSector, fEquipo, fResp, fEstado, fPrioridad]);

  const conFecha = useMemo(() => filtered.filter((o) => !!ediScheduledDate(o)), [filtered]);
  const sinFecha = useMemo(() => filtered.filter((o) => !ediScheduledDate(o) && o.estado !== "Cumplido"), [filtered]);

  const resumen = useMemo(() => {
    let pend = 0, proc = 0, venc = 0, mes = 0;
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    for (const o of filtered) {
      const st = edilicioEstado(o, todayISO);
      if (st === "Vencida") venc++;
      else if (st === "Pendiente") pend++;
      else if (st === "En proceso") proc++;
      const d = ediScheduledDate(o);
      if (d && d.startsWith(ym)) mes++;
    }
    return { pend, proc, venc, mes };
  }, [filtered, todayISO, year, month]);

  const listaOrdenada = useMemo(() => {
    const arr = [...filtered];
    const dir = sortAsc ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "fecha") {
        const va = edilicioEstado(a, todayISO) === "Vencida" ? 0 : 1;
        const vb = edilicioEstado(b, todayISO) === "Vencida" ? 0 : 1;
        if (va !== vb) return va - vb;
        const da = ediScheduledDate(a) || "9999-12-31";
        const db = ediScheduledDate(b) || "9999-12-31";
        return da.localeCompare(db) * dir;
      }
      if (sortKey === "nro") return (Number(a.nroOrden) - Number(b.nroOrden)) * dir;
      if (sortKey === "sector") return a.sector.localeCompare(b.sector) * dir;
      if (sortKey === "equipo") return (a.codigoEquipo || a.nombreEquipo).localeCompare(b.codigoEquipo || b.nombreEquipo) * dir;
      if (sortKey === "prioridad") {
        const rank: Record<string, number> = { Alta: 0, Media: 1, Baja: 2, "": 3 };
        return ((rank[a.prioridad] ?? 3) - (rank[b.prioridad] ?? 3)) * dir;
      }
      return String(a.estado).localeCompare(String(b.estado)) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortAsc, todayISO]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(true); }
  }

  function prev() {
    if (calMode === "mes") { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }
    else {
      const [y, m, d] = weekStart.split("-").map(Number);
      const dt = new Date(y, m - 1, d - 7);
      setWeekStart(isoOf(dt));
    }
  }
  function next() {
    if (calMode === "mes") { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }
    else {
      const [y, m, d] = weekStart.split("-").map(Number);
      const dt = new Date(y, m - 1, d + 7);
      setWeekStart(isoOf(dt));
    }
  }
  function goToday() {
    setYear(Number(todayISO.slice(0, 4)));
    setMonth(Number(todayISO.slice(5, 7)));
    setWeekStart(mondayOf(todayISO));
  }
  function clearFilters() { setFSector(""); setFEquipo(""); setFResp(""); setFEstado(""); setFPrioridad(""); }

  const dayItems = dayOpen ? conFecha.filter((o) => ediScheduledDate(o) === dayOpen) : [];
  const equipOpts = equipment.map((e) => ({ value: e.code, label: `${e.code} - ${e.name}` }));
  const respOpts = people.filter((p) => p.can_be_technician).map((p) => ({ value: p.full_name, label: p.full_name }));

  function Row({ o }: { o: Orden }) {
    const st = edilicioEstado(o, todayISO);
    return (
      <tr className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => navigate(`/orden/${o.id}`)}>
        <td className="px-2 py-1.5 font-medium">{o.nroOrden}</td>
        <td className="px-2 py-1.5 whitespace-nowrap">
          {fmt(ediScheduledDate(o))}
          {st === "Vencida" && <span className="ml-1 text-[10px] px-1 rounded bg-destructive text-destructive-foreground">Vencida</span>}
        </td>
        <td className="px-2 py-1.5">{o.sector || "—"}</td>
        <td className="px-2 py-1.5">{o.codigoEquipo || o.nombreEquipo || "—"}</td>
        <td className="px-2 py-1.5 max-w-[320px] truncate">{o.trabajoSolicitado || o.descripcionProblema || "—"}</td>
        <td className="px-2 py-1.5"><PrioridadBadge prioridad={o.prioridad} /></td>
        <td className="px-2 py-1.5">{(o.tecnicosResponsables?.length ? o.tecnicosResponsables.join(", ") : o.tecnicoResponsable) || "—"}</td>
        <td className="px-2 py-1.5"><EstadoBadge estado={o.estado} /></td>
      </tr>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Mantenimiento Edilicio</h1>
            <p className="text-sm text-muted-foreground">Planificación y seguimiento de OITs de mantenimiento edilicio</p>
          </div>
          <div className="flex gap-2">
            {canCreateOrden(roles) && (
              <Button onClick={() => navigate("/orden/nueva?tipo=EDILICIO")}><Plus className="h-4 w-4 mr-1" />Nueva OIT Edilicia</Button>
            )}
            <Button variant="ghost" onClick={() => loadAll()}><RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />Refrescar</Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-sm items-end">
            <div>
              <Label className="text-xs">Sector</Label>
              <SearchSelect value={fSector} onChange={setFSector} options={sectors.map((s) => ({ value: s.name, label: s.name }))} placeholder="Todos" />
            </div>
            <div>
              <Label className="text-xs">Equipo</Label>
              <SearchSelect value={fEquipo} onChange={setFEquipo} options={equipOpts} placeholder="Todos" />
            </div>
            <div>
              <Label className="text-xs">Responsable</Label>
              <SearchSelect value={fResp} onChange={setFResp} options={respOpts} placeholder="Todos" />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={fEstado || "all"} onValueChange={(v) => setFEstado(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="En proceso">En proceso</SelectItem>
                  <SelectItem value="Cumplido">Cumplido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={fPrioridad || "all"} onValueChange={(v) => setFPrioridad(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
          </CardContent>
        </Card>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { l: "Pendientes", v: resumen.pend },
            { l: "En proceso", v: resumen.proc },
            { l: "Vencidas", v: resumen.venc, danger: true },
            { l: "Programadas este mes", v: resumen.mes },
          ].map((k) => (
            <div key={k.l} className="border rounded px-3 py-2">
              <div className="text-xs text-muted-foreground">{k.l}</div>
              <div className={cn("text-2xl font-bold", k.danger && k.v > 0 && "text-destructive")}>{k.v}</div>
            </div>
          ))}
          <button onClick={() => setNoDateOpen(true)} className="border rounded px-3 py-2 text-left hover:bg-muted/40">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" />Sin fecha programada</div>
            <div className="text-2xl font-bold">{sinFecha.length}</div>
          </button>
        </div>

        {/* Vistas */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="calendario">Calendario</TabsTrigger>
              <TabsTrigger value="listado">Listado</TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "calendario" && (
            <Tabs value={calMode} onValueChange={(v) => setCalMode(v as any)}>
              <TabsList>
                <TabsTrigger value="mes">Mes</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] ml-auto">
            {(["Pendiente", "En proceso", "Cumplido", "Vencida"] as const).map((s) => (
              <span key={s} className={cn("px-2 py-0.5 rounded border", EDILICIO_STATUS_COLORS[s])}>{s}</span>
            ))}
          </div>
        </div>

        {view === "calendario" ? (
          <EdiliciosCalendar
            items={conFecha}
            year={year}
            month={month}
            mode={calMode}
            weekStartISO={weekStart}
            todayISO={todayISO}
            onPrev={prev}
            onNext={next}
            onToday={goToday}
            onDayClick={(iso) => setDayOpen(iso)}
            onItemClick={(o) => navigate(`/orden/${o.id}`)}
          />
        ) : (
          <div className="border rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  {([["nro", "Nº OIT"], ["fecha", "Fecha programada"], ["sector", "Sector"], ["equipo", "Equipo / ubicación"]] as [SortKey, string][]).map(([k, l]) => (
                    <th key={k} className="px-2 py-2 cursor-pointer select-none" onClick={() => toggleSort(k)}>
                      <span className="inline-flex items-center gap-1">{l}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                    </th>
                  ))}
                  <th className="px-2 py-2">Descripción</th>
                  <th className="px-2 py-2 cursor-pointer" onClick={() => toggleSort("prioridad")}>Prioridad</th>
                  <th className="px-2 py-2">Responsable</th>
                  <th className="px-2 py-2 cursor-pointer" onClick={() => toggleSort("estado")}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {listaOrdenada.map((o) => <Row key={o.id} o={o} />)}
                {listaOrdenada.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Sin OITs edilicias para los filtros seleccionados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!dayOpen} onOpenChange={(v) => !v && setDayOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>OITs edilicias del {fmt(dayOpen || "")}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {dayItems.map((o) => (
              <button key={o.id} onClick={() => { setDayOpen(null); navigate(`/orden/${o.id}`); }} className="w-full text-left border rounded p-2 hover:bg-muted/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">OIT {o.nroOrden}</span>
                  <EstadoBadge estado={o.estado} />
                  <PrioridadBadge prioridad={o.prioridad} />
                  {edilicioEstado(o, todayISO) === "Vencida" && <span className="text-[10px] px-1 rounded bg-destructive text-destructive-foreground">Vencida</span>}
                </div>
                <div className="text-xs text-muted-foreground">{o.codigoEquipo || o.nombreEquipo || o.sector}</div>
                <div className="text-sm">{o.trabajoSolicitado || o.descripcionProblema}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noDateOpen} onOpenChange={setNoDateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>OITs edilicias abiertas sin fecha programada</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {sinFecha.length === 0 && <div className="text-sm text-muted-foreground">Todas las OITs abiertas tienen fecha asignada.</div>}
            {sinFecha.map((o) => (
              <button key={o.id} onClick={() => { setNoDateOpen(false); navigate(`/orden/${o.id}`); }} className="w-full text-left border rounded p-2 hover:bg-muted/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">OIT {o.nroOrden}</span>
                  <EstadoBadge estado={o.estado} />
                  <PrioridadBadge prioridad={o.prioridad} />
                </div>
                <div className="text-xs text-muted-foreground">{o.codigoEquipo || o.nombreEquipo || o.sector}</div>
                <div className="text-sm">{o.trabajoSolicitado || o.descripcionProblema}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
