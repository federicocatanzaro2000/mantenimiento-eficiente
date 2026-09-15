import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, SearchOption } from "@/components/SearchSelect";
import { listSectors, listPeople, listEquipment, Person, Sector, Equipment } from "@/lib/catalogos/api";
import { listPreventives } from "@/lib/preventiveManual/api";
import { PreventiveItem, effectiveStatus, todayISOArgentina, daysBetweenISO } from "@/lib/preventiveManual/types";
import { Orden, Filtros, filtrosVacios } from "@/types/orden";
import { AlertTriangle, Timer, ShieldCheck, Wrench, Scale, RotateCcw, RefreshCw, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// ───────────── helpers ─────────────
const todayISO = () => todayISOArgentina();
const addDaysISO = (base: string, days: number) => {
  const [y, m, d] = base.split("-").map(Number);
  const t = Date.UTC(y, (m ?? 1) - 1, (d ?? 1)) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};
const firstOfMonth = (base: string) => `${base.slice(0, 7)}-01`;
const firstOfYear = (base: string) => `${base.slice(0, 4)}-01-01`;
const startOfWeek = (base: string) => {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const dow = (dt.getUTCDay() + 6) % 7; // lunes = 0
  return addDaysISO(base, -dow);
};
const inRange = (d: string | null | undefined, from: string, to: string) => {
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtH = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h`;
const fmtDate = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "Sin dato");
const dash = (v?: string | null) => (v && String(v).trim() ? String(v) : "Sin dato");

const tecnicosDe = (o: Orden) =>
  (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
    ? o.tecnicosResponsables
    : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []);

const isCorrectivo = (o: Orden) => String(o.tipoOrden ?? "").toLowerCase().includes("correctiv");
const isPreventivo = (o: Orden) => String(o.tipoOrden ?? "").toLowerCase().includes("preventiv");
const isClosed = (o: Orden) => o.estado === "Cumplido";
const isOpen = (o: Orden) => o.estado === "Pendiente" || o.estado === "En proceso";
const equipoLabel = (o: Orden) => {
  const t = [o.codigoEquipo?.trim(), o.nombreEquipo?.trim()].filter(Boolean).join(" — ");
  return t || (o.projectHasEquipment === false ? "Sin equipo asociado" : "Sin dato");
};

type PeriodKey = "semana" | "30" | "90" | "mes" | "anio" | "custom";

interface KFilters {
  period: PeriodKey;
  desde: string;
  hasta: string;
  sector: string;
  codigoEquipo: string;
  tecnico: string;
}

function rangeFor(period: PeriodKey, desde: string, hasta: string) {
  const t = todayISO();
  switch (period) {
    case "semana": return { desde: startOfWeek(t), hasta: t };
    case "30": return { desde: addDaysISO(t, -30), hasta: t };
    case "90": return { desde: addDaysISO(t, -90), hasta: t };
    case "mes": return { desde: firstOfMonth(t), hasta: t };
    case "anio": return { desde: firstOfYear(t), hasta: t };
    default: return { desde, hasta };
  }
}

const emptyFilters: KFilters = {
  period: "30",
  desde: addDaysISO(todayISO(), -30),
  hasta: todayISO(),
  sector: "", codigoEquipo: "", tecnico: "",
};

// ───────────── UI atoms ─────────────
function BigKpi({ title, value, unit, sub, tone, icon: Icon, onClick }: {
  title: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode;
  tone?: "neutral" | "danger" | "warning" | "success"; icon: any; onClick: () => void;
}) {
  const border =
    tone === "danger" ? "border-l-destructive" :
    tone === "warning" ? "border-l-[hsl(var(--warning))]" :
    tone === "success" ? "border-l-[hsl(var(--success))]" : "border-l-primary";
  const valueTone =
    tone === "danger" ? "text-destructive" :
    tone === "warning" ? "text-[hsl(var(--warning))]" :
    tone === "success" ? "text-[hsl(var(--success))]" : "text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full bg-card border border-border rounded-md shadow-sm p-4 border-l-4 ${border} hover:shadow-md hover:bg-accent/30 transition`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{title}</div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <div className={`mt-2 font-bold tabular-nums leading-tight ${valueTone} text-3xl`}>
        {value}{unit && <span className="text-base font-semibold ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2 leading-snug">{sub}</div>}
      <div className="text-[11px] text-primary mt-2 flex items-center gap-1">Ver detalle <ChevronRight className="h-3 w-3" /></div>
    </button>
  );
}

function Section({ id, title, subtitle, action, children }: {
  id: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-card border border-border rounded-md shadow-sm scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-secondary/40 rounded-t-md">
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Bars({ data, unit }: { data: { label: string; value: number; onClick?: () => void }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Sin datos en el período seleccionado.</p>;
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <button
          key={d.label}
          type="button"
          onClick={d.onClick}
          className="w-full text-left grid grid-cols-[minmax(120px,220px)_1fr_auto] items-center gap-3 hover:bg-accent/40 rounded px-1 py-0.5"
        >
          <span className="text-xs truncate" title={d.label}>{d.label}</span>
          <span className="h-3 bg-secondary rounded overflow-hidden">
            <span className="block h-full bg-primary rounded" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="text-xs tabular-nums font-medium w-20 text-right">
            {d.value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} {unit}
          </span>
        </button>
      ))}
    </div>
  );
}

const th = "px-2 py-1.5 text-left font-semibold text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap";
const td = "px-2 py-1.5 align-top";

// ───────────── page ─────────────
export default function KpisPage() {
  const navigate = useNavigate();
  const ordenes = useOrdenesStore((s) => s.ordenes);
  const loaded = useOrdenesStore((s) => s.loaded);
  const loadAll = useOrdenesStore((s) => s.loadAll);
  const setFiltros = useOrdenesStore((s) => s.setFiltros);

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [equipos, setEquipos] = useState<Equipment[]>([]);
  const [preventivos, setPreventivos] = useState<PreventiveItem[]>([]);
  const [prevError, setPrevError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [f, setFs] = useState<KFilters>(emptyFilters);
  const set = <K extends keyof KFilters>(k: K, v: KFilters[K]) => setFs((p) => ({ ...p, [k]: v }));

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [s, p, e] = await Promise.all([listSectors(), listPeople(), listEquipment()]);
      setSectors(s); setPeople(p); setEquipos(e);
    } catch (err: any) {
      setError("No se pudieron cargar los catálogos: " + (err?.message ?? ""));
    }
    try {
      setPreventivos(await listPreventives({ activeOnly: true }));
      setPrevError(false);
    } catch { setPrevError(true); setPreventivos([]); }
    try { await loadAll(); } catch (err: any) { setError("No se pudieron cargar las OITs: " + (err?.message ?? "")); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rango = useMemo(() => rangeFor(f.period, f.desde, f.hasta), [f.period, f.desde, f.hasta]);
  const hoy = todayISO();

  const peopleById = useMemo(() => {
    const m = new Map<string, string>();
    people.forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [people]);

  const optSectores = useMemo<SearchOption[]>(() => sectors.filter((s) => s.active).map((s) => ({ value: s.name, label: s.name })), [sectors]);
  const optEquipos = useMemo<SearchOption[]>(() => equipos.filter((e) => e.active).map((e) => ({ value: e.code, label: `${e.code} — ${e.name}` })), [equipos]);
  const optTecnicos = useMemo<SearchOption[]>(() => people.filter((p) => p.can_be_technician).map((p) => ({ value: p.full_name, label: p.full_name, inactive: !p.active })), [people]);

  // Filtro estructural (sin fecha): aplica a todos los KPIs.
  const baseOrdenes = useMemo<Orden[]>(() => ordenes.filter((o) => {
    if (f.sector && o.sector !== f.sector) return false;
    if (f.codigoEquipo && (o.codigoEquipo ?? "").toLowerCase() !== f.codigoEquipo.toLowerCase()) return false;
    if (f.tecnico && !tecnicosDe(o).some((x) => x.toLowerCase().includes(f.tecnico.toLowerCase()))) return false;
    return true;
  }), [ordenes, f.sector, f.codigoEquipo, f.tecnico]);

  // Con período (por fecha de creación).
  const periodoOrdenes = useMemo<Orden[]>(
    () => baseOrdenes.filter((o) => inRange(o.fechaCreacion, rango.desde, rango.hasta)),
    [baseOrdenes, rango.desde, rango.hasta],
  );

  const ordenById = useMemo(() => {
    const m = new Map<string, Orden>();
    ordenes.forEach((o) => m.set(o.id, o));
    return m;
  }, [ordenes]);

  // ───────── KPI 1: vencidas y críticas (foto actual, sin filtro de fecha) ─────────
  const kpi1 = useMemo(() => {
    const vencidas = baseOrdenes
      .filter((o) => isOpen(o) && !!o.fechaLimiteRealizacion && o.fechaLimiteRealizacion < hoy)
      .map((o) => ({ o, dias: -daysBetweenISO(o.fechaLimiteRealizacion, hoy) }));
    const criticas = vencidas.filter((r) => r.o.prioridad === "Alta");
    const prioRank = (p: string) => (p === "Alta" ? 0 : p === "Media" ? 1 : 2);
    const rows = [...vencidas].sort((a, b) => prioRank(a.o.prioridad) - prioRank(b.o.prioridad) || b.dias - a.dias);
    return { rows, total: vencidas.length, criticas: criticas.length, maxAtraso: rows.length ? Math.max(...rows.map((r) => r.dias)) : 0 };
  }, [baseOrdenes, hoy]);

  // ───────── KPI 2: correctivos con parada de línea ─────────
  const kpi2 = useMemo(() => {
    const rows = periodoOrdenes
      .filter((o) => isCorrectivo(o) && o.lineStopped === true)
      .sort((a, b) => num(b.lineStoppedHours) - num(a.lineStoppedHours));
    const horas = rows.reduce((s, o) => s + num(o.lineStoppedHours), 0);
    const porEquipo = new Map<string, number>();
    rows.forEach((o) => {
      const k = equipoLabel(o);
      porEquipo.set(k, (porEquipo.get(k) ?? 0) + num(o.lineStoppedHours));
    });
    const ranking = Array.from(porEquipo.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    return { rows, horas, cantidad: rows.length, ranking };
  }, [periodoOrdenes]);

  // ───────── KPI 3: cumplimiento preventivo ─────────
  const kpi3 = useMemo(() => {
    const base = preventivos.filter((p) => {
      if (f.codigoEquipo && (p.equipment_code_snapshot ?? "").toLowerCase() !== f.codigoEquipo.toLowerCase()) return false;
      if (f.tecnico) {
        const nombre = p.responsible_id ? peopleById.get(p.responsible_id) ?? "" : "";
        if (!nombre.toLowerCase().includes(f.tecnico.toLowerCase())) return false;
      }
      if (f.sector) {
        // El preventivo no tiene sector propio: se infiere por el equipo cargado en OITs de ese sector.
        const code = (p.equipment_code_snapshot ?? "").toLowerCase();
        if (!code) return false;
        const match = ordenes.some((o) => (o.codigoEquipo ?? "").toLowerCase() === code && o.sector === f.sector);
        if (!match) return false;
      }
      return true;
    });

    const enPeriodo = base.filter((p) => inRange(p.scheduled_date, rango.desde, rango.hasta));
    // Denominador: sólo lo que ya correspondía ejecutarse (no futuros) y no cancelados.
    const debidos = enPeriodo.filter((p) => p.scheduled_date <= hoy && effectiveStatus(p, hoy) !== "Cancelado");

    const fechaRealizacion = (p: PreventiveItem): string | null => {
      const o = p.work_order_id ? ordenById.get(p.work_order_id) : undefined;
      if (o?.fechaFinalizacion) return o.fechaFinalizacion;
      return p.updated_at ? p.updated_at.slice(0, 10) : null;
    };

    let enTermino = 0, fueraTermino = 0;
    debidos.forEach((p) => {
      if (effectiveStatus(p, hoy) !== "Realizado") return;
      const fr = fechaRealizacion(p);
      if (fr && fr <= p.scheduled_date) enTermino++; else fueraTermino++;
    });

    const vencidosRows = base
      .filter((p) => effectiveStatus(p, hoy) === "Vencido")
      .map((p) => ({ p, dias: -daysBetweenISO(p.scheduled_date, hoy) }))
      .sort((a, b) => b.dias - a.dias);
    const vencidosPeriodo = debidos.filter((p) => effectiveStatus(p, hoy) === "Vencido").length;
    const proximos = base.filter((p) => {
      const st = effectiveStatus(p, hoy);
      return p.scheduled_date >= hoy && st !== "Realizado" && st !== "Cancelado";
    }).length;

    // OITs preventivas creadas por fuera del cronograma (sin item asociado):
    // también son mantenimiento preventivo y deben contar en el cumplimiento.
    const idsConItem = new Set(preventivos.map((p) => p.work_order_id).filter((v): v is string => !!v));
    const fechaRefOIT = (o: Orden) => o.fechaLimiteRealizacion || o.fechaCreacion || "";
    const sueltas = baseOrdenes.filter(
      (o) => isPreventivo(o) && !idsConItem.has(o.id) && inRange(fechaRefOIT(o), rango.desde, rango.hasta),
    );
    const sueltasDebidas = sueltas.filter((o) => fechaRefOIT(o) <= hoy);
    let sueltasEnTermino = 0, sueltasFueraTermino = 0, sueltasVencidas = 0;
    sueltasDebidas.forEach((o) => {
      if (isClosed(o)) {
        const lim = o.fechaLimiteRealizacion;
        if (!lim || !o.fechaFinalizacion || o.fechaFinalizacion <= lim) sueltasEnTermino++;
        else sueltasFueraTermino++;
      } else {
        sueltasVencidas++;
      }
    });
    const sueltasProximas = sueltas.filter((o) => fechaRefOIT(o) >= hoy && !isClosed(o)).length;

    const denom = debidos.length + sueltasDebidas.length;
    const totalEnTermino = enTermino + sueltasEnTermino;
    const pct = denom > 0 ? Math.round((totalEnTermino / denom) * 100) : null;
    return {
      denom,
      enTermino: totalEnTermino,
      fueraTermino: fueraTermino + sueltasFueraTermino,
      vencidosPeriodo: vencidosPeriodo + sueltasVencidas,
      vencidosRows,
      proximos: proximos + sueltasProximas,
      pct,
      sinCronograma: sueltasDebidas.length,
    };
  }, [preventivos, f.codigoEquipo, f.tecnico, f.sector, peopleById, ordenes, baseOrdenes, ordenById, rango.desde, rango.hasta, hoy]);

  // ───────── KPI 4: equipos con mayor intervención (mismo período global) ─────────
  const kpi4 = useMemo(() => {
    const rows = periodoOrdenes.filter((o) => isCorrectivo(o));
    const m = new Map<string, { label: string; codigo: string; cant: number; horasReales: number; horasParada: number }>();
    const vistos = new Set<string>();
    rows.forEach((o) => {
      if (vistos.has(o.id)) return; // sin doble conteo
      vistos.add(o.id);
      // Sólo OITs con equipo real: las sin equipo no son un equipo.
      if (!o.codigoEquipo?.trim() && !o.nombreEquipo?.trim()) return;
      const k = equipoLabel(o);
      const cur = m.get(k) ?? { label: k, codigo: o.codigoEquipo ?? "", cant: 0, horasReales: 0, horasParada: 0 };
      cur.cant += 1;
      cur.horasReales += num(o.horasReales);
      if (o.lineStopped === true) cur.horasParada += num(o.lineStoppedHours);
      m.set(k, cur);
    });
    const ranking = Array.from(m.values()).sort((a, b) => b.cant - a.cant).slice(0, 10);
    return { ranking, top: ranking[0] ?? null };
  }, [periodoOrdenes]);

  // ───────── KPI 5: horas presupuestadas vs. reales ─────────
  const kpi5 = useMemo(() => {
    const rows = periodoOrdenes.map((o) => {
      const pres = num(o.horasPresupuestadas);
      const real = num(o.horasReales);
      const desv = real - pres;
      const desvPct = pres > 0 ? (desv / pres) * 100 : null;
      const significativo = (desvPct !== null && Math.abs(desvPct) > 20) || Math.abs(desv) > 2;
      return { o, pres, real, desv, desvPct, significativo };
    });
    const conHoras = rows.filter((r) => r.pres > 0 || r.real > 0);
    const pres = conHoras.reduce((s, r) => s + r.pres, 0);
    const real = conHoras.reduce((s, r) => s + r.real, 0);
    const desv = real - pres;
    const desvPct = pres > 0 ? Math.round((desv / pres) * 100) : null;
    const top = [...conHoras].sort((a, b) => Math.abs(b.desv) - Math.abs(a.desv)).slice(0, 15);
    return { pres, real, desv, desvPct, top, significativos: conHoras.filter((r) => r.significativo).length, evaluadas: conHoras.length };
  }, [periodoOrdenes]);

  // ───────── navegación ─────────
  const goResultados = (patch: Partial<Filtros>, conFechas = true) => {
    const base: Filtros = { ...filtrosVacios };
    if (conFechas) { base.fechaCreacionDesde = rango.desde; base.fechaCreacionHasta = rango.hasta; }
    if (f.sector) base.sector = f.sector;
    if (f.codigoEquipo) base.codigoEquipo = f.codigoEquipo;
    if (f.tecnico) base.tecnicoResponsable = f.tecnico;
    setFiltros({ ...base, ...patch });
    navigate("/resultados");
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const abrirOIT = (id: string) => navigate(`/orden/${id}`);

  const cumplTone = kpi3.pct === null ? "neutral" : kpi3.pct >= 95 ? "success" : kpi3.pct >= 90 ? "warning" : "danger";

  if (loading && !loaded) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-72 bg-muted rounded animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 bg-muted rounded-md animate-pulse" />)}
          </div>
          <div className="h-64 bg-muted rounded-md animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">KPIs de Mantenimiento</h2>
            <p className="text-sm text-muted-foreground">Indicadores clave para el seguimiento operativo del mantenimiento</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 text-destructive text-sm rounded-md px-3 py-2">{error}</div>
        )}

        {/* Filtros */}
        <div className="bg-card border border-border rounded-md shadow-sm p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <div className="flex flex-wrap gap-1">
                {([
                  ["semana", "Esta semana"], ["30", "Últimos 30 días"], ["90", "Últimos 90 días"],
                  ["mes", "Mes actual"], ["anio", "Año actual"], ["custom", "Personalizado"],
                ] as [PeriodKey, string][]).map(([k, label]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={f.period === k ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => set("period", k)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {f.period === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" className="h-9 w-[150px]" value={f.desde} onChange={(e) => set("desde", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" className="h-9 w-[150px]" value={f.hasta} onChange={(e) => set("hasta", e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1 w-[190px]">
              <Label className="text-xs">Sector</Label>
              <SearchSelect value={f.sector} onChange={(v) => set("sector", v)} options={optSectores} placeholder="Todos" />
            </div>
            <div className="space-y-1 w-[220px]">
              <Label className="text-xs">Equipo</Label>
              <SearchSelect value={f.codigoEquipo} onChange={(v) => set("codigoEquipo", v)} options={optEquipos} placeholder="Todos" />
            </div>
            <div className="space-y-1 w-[200px]">
              <Label className="text-xs">Técnico / responsable</Label>
              <SearchSelect value={f.tecnico} onChange={(v) => set("tecnico", v)} options={optTecnicos} placeholder="Todos" />
            </div>
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => setFs(emptyFilters)}>
              <RotateCcw className="h-4 w-4" /> Limpiar filtros
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Período aplicado: {fmtDate(rango.desde)} — {fmtDate(rango.hasta)}. Las OITs vencidas y los preventivos vencidos son la foto del estado actual.
          </p>
        </div>

        {/* NIVEL 1 */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <BigKpi
            title="OITs vencidas y críticas"
            value={kpi1.criticas}
            icon={AlertTriangle}
            tone={kpi1.criticas > 0 ? "danger" : "success"}
            sub={<>Total vencidas: <b>{kpi1.total}</b><br />Mayor atraso: <b>{kpi1.maxAtraso} días</b></>}
            onClick={() => scrollTo("kpi1")}
          />
          <BigKpi
            title="Horas de línea parada"
            value={kpi2.horas.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
            unit="h"
            icon={Timer}
            sub={<>{kpi2.cantidad} intervenciones con parada</>}
            onClick={() => scrollTo("kpi2")}
          />
          <BigKpi
            title="Cumplimiento preventivo"
            value={kpi3.pct === null ? "Sin dato" : kpi3.pct}
            unit={kpi3.pct === null ? undefined : "%"}
            icon={ShieldCheck}
            tone={cumplTone as any}
            sub={<>{kpi3.enTermino} realizados en término · {kpi3.vencidosPeriodo} vencidos</>}
            onClick={() => scrollTo("kpi3")}
          />
          <BigKpi
            title="Equipo con más intervenciones"
            value={<span className="text-xl">{kpi4.top ? kpi4.top.label : "Sin dato"}</span>}
            icon={Wrench}
            sub={kpi4.top ? <>{kpi4.top.cant} correctivos en el período</> : <>Sin correctivos en el período</>}
            onClick={() => scrollTo("kpi4")}
          />
          <BigKpi
            title="Desvío horas presup. vs. reales"
            value={<span className={kpi5.desv > 0 ? "text-destructive" : kpi5.desv < 0 ? "text-[hsl(var(--success))]" : ""}>
              {kpi5.desv > 0 ? "+" : ""}{kpi5.desv.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h
            </span>}
            icon={Scale}
            sub={<>Presup.: <b>{fmtH(kpi5.pres)}</b> · Reales: <b>{fmtH(kpi5.real)}</b><br />{kpi5.desvPct === null ? "% N/A" : `${kpi5.desvPct > 0 ? "+" : ""}${kpi5.desvPct}%`}</>}
            onClick={() => scrollTo("kpi5")}
          />
        </div>

        {/* KPI 1 detalle */}
        <Section
          id="kpi1"
          title="1 · OITs vencidas y críticas"
          subtitle="Órdenes abiertas cuya fecha límite ya pasó. Ordenadas por prioridad y días de atraso."
          action={<Button size="sm" variant="outline" onClick={() => goResultados({ estado: ["Pendiente", "En proceso"], fechaLimiteHasta: addDaysISO(hoy, -1) }, false)}>Ver en Resultados</Button>}
        >
          {kpi1.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay OITs vencidas con los filtros actuales.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40"><tr>
                  {["Nº OIT", "Equipo", "Descripción", "Prioridad", "Estado", "Fecha límite", "Días de atraso", "Responsable", "Observaciones"].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {kpi1.rows.slice(0, 30).map(({ o, dias }) => (
                    <tr key={o.id} onClick={() => abrirOIT(o.id)} className="border-t border-border hover:bg-accent/40 cursor-pointer">
                      <td className={`${td} font-medium`}>{o.nroOrden || "Sin dato"}</td>
                      <td className={td}>{equipoLabel(o)}</td>
                      <td className={`${td} max-w-[280px] truncate`} title={o.descripcionProblema || o.trabajoSolicitado}>{dash(o.descripcionProblema || o.trabajoSolicitado)}</td>
                      <td className={td}>
                        <span className={o.prioridad === "Alta" ? "text-destructive font-semibold" : ""}>{dash(o.prioridad)}</span>
                      </td>
                      <td className={td}>{dash(o.estado)}</td>
                      <td className={td}>{fmtDate(o.fechaLimiteRealizacion)}</td>
                      <td className={`${td} tabular-nums font-semibold ${dias > 15 ? "text-destructive" : dias > 5 ? "text-[hsl(var(--warning))]" : ""}`}>{dias}</td>
                      <td className={td}>{tecnicosDe(o).join(", ") || "Sin dato"}</td>
                      <td className={`${td} max-w-[220px] truncate`} title={o.observaciones}>{dash(o.observaciones)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {kpi1.rows.length > 30 && <p className="text-[11px] text-muted-foreground mt-2">Mostrando 30 de {kpi1.rows.length}.</p>}
            </div>
          )}
        </Section>

        {/* KPI 2 detalle */}
        <Section
          id="kpi2"
          title="2 · Correctivos con parada de línea"
          subtitle={`Horas de producción perdidas entre ${fmtDate(rango.desde)} y ${fmtDate(rango.hasta)}.`}
        >
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <div className="border border-border rounded-md p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Horas de línea parada</div>
              <div className="text-2xl font-bold tabular-nums">{fmtH(kpi2.horas)}</div>
            </div>
            <div className="border border-border rounded-md p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Correctivos con parada</div>
              <div className="text-2xl font-bold tabular-nums">{kpi2.cantidad}</div>
            </div>
            <div className="border border-border rounded-md p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Horas reales de mantenimiento</div>
              <div className="text-2xl font-bold tabular-nums">{fmtH(kpi2.rows.reduce((s, o) => s + num(o.horasReales), 0))}</div>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-xs font-semibold mb-2">Ranking de equipos por horas de línea parada</div>
            <Bars unit="h" data={kpi2.ranking.map((r) => ({ label: r.label, value: r.value }))} />
          </div>
          {kpi2.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40"><tr>
                  {["Nº OIT", "Equipo", "Fecha", "Descripción / motivo", "Responsable", "Hs. línea parada", "Hs. reales"].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {kpi2.rows.slice(0, 20).map((o) => (
                    <tr key={o.id} onClick={() => abrirOIT(o.id)} className="border-t border-border hover:bg-accent/40 cursor-pointer">
                      <td className={`${td} font-medium`}>{o.nroOrden || "Sin dato"}</td>
                      <td className={td}>{equipoLabel(o)}</td>
                      <td className={td}>{fmtDate(o.fechaCreacion)}</td>
                      <td className={`${td} max-w-[300px] truncate`} title={o.descripcionProblema || o.trabajoSolicitado}>{dash(o.descripcionProblema || o.trabajoSolicitado)}</td>
                      <td className={td}>{tecnicosDe(o).join(", ") || "Sin dato"}</td>
                      <td className={`${td} tabular-nums font-semibold`}>{num(o.lineStoppedHours).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                      <td className={`${td} tabular-nums`}>{num(o.horasReales).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* KPI 3 detalle */}
        <Section
          id="kpi3"
          title="3 · Cumplimiento de mantenimiento preventivo"
          subtitle="Preventivos que correspondía ejecutar en el período: cronograma + OITs preventivas cargadas por fuera del cronograma (no incluye futuros)."
          action={<Button size="sm" variant="outline" onClick={() => navigate("/preventivos")}>Ir a Preventivos</Button>}
        >
          {prevError ? (
            <p className="text-sm text-destructive">No se pudo cargar el módulo de Preventivos.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4 mb-4">
                {[
                  ["Realizados en término", kpi3.enTermino, "text-[hsl(var(--success))]"],
                  ["Realizados fuera de término", kpi3.fueraTermino, "text-[hsl(var(--warning))]"],
                  ["Vencidos", kpi3.vencidosPeriodo, "text-destructive"],
                  ["Próximos", kpi3.proximos, ""],
                ].map(([label, val, cls]) => (
                  <div key={String(label)} className="border border-border rounded-md p-3">
                    <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
                    <div className={`text-2xl font-bold tabular-nums ${cls}`}>{val as number}</div>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold">Cumplimiento</span>
                  <span className="tabular-nums font-semibold">{kpi3.pct === null ? "Sin dato" : `${kpi3.pct}%`} · base {kpi3.denom} preventivos{kpi3.sinCronograma > 0 ? ` (incluye ${kpi3.sinCronograma} OITs fuera del cronograma)` : ""}</span>
                </div>
                <div className="h-3 bg-secondary rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${kpi3.pct === null ? "bg-muted" : kpi3.pct >= 95 ? "bg-[hsl(var(--success))]" : kpi3.pct >= 90 ? "bg-[hsl(var(--warning))]" : "bg-destructive"}`}
                    style={{ width: `${kpi3.pct ?? 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Objetivo ≥ 95% · Aceptable ≥ 90% · Requiere atención &lt; 90%</p>
              </div>
              <div className="text-xs font-semibold mb-2">Preventivos vencidos</div>
              {kpi3.vencidosRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay preventivos vencidos con los filtros actuales.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40"><tr>
                      {["Equipo", "Preventivo", "Fecha programada", "Días vencido", "Responsable", "OIT asociada"].map((h) => <th key={h} className={th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {kpi3.vencidosRows.slice(0, 20).map(({ p, dias }) => {
                        const oit = p.work_order_id ? ordenById.get(p.work_order_id) : undefined;
                        return (
                          <tr key={p.id} className="border-t border-border hover:bg-accent/40">
                            <td className={td}>{[p.equipment_code_snapshot, p.equipment_name_snapshot].filter(Boolean).join(" — ") || "Sin dato"}</td>
                            <td className={td}>{dash(p.task_name)}</td>
                            <td className={td}>{fmtDate(p.scheduled_date)}</td>
                            <td className={`${td} tabular-nums font-semibold text-destructive`}>{dias}</td>
                            <td className={td}>{p.responsible_id ? (peopleById.get(p.responsible_id) ?? "Sin dato") : "Sin dato"}</td>
                            <td className={td}>
                              {oit ? (
                                <button className="text-primary underline" onClick={() => abrirOIT(oit.id)}>OIT {oit.nroOrden}</button>
                              ) : "Sin OIT"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {kpi3.vencidosRows.length > 20 && <p className="text-[11px] text-muted-foreground mt-2">Mostrando 20 de {kpi3.vencidosRows.length}.</p>}
                </div>
              )}
            </>
          )}
        </Section>

        {/* KPI 4 detalle */}
        <Section
          id="kpi4"
          title="4 · Equipos con mayor intervención"
          subtitle={`Cantidad de OITs correctivas distintas por equipo. Período: ${fmtDate(rango.desde)} — ${fmtDate(rango.hasta)}.`}
        >
          <div className="mb-4">
            <Bars
              unit="OITs"
              data={kpi4.ranking.map((r) => ({
                label: r.label,
                value: r.cant,
                onClick: () => goResultados({
                  codigoEquipo: r.codigo || "", nombreEquipo: r.codigo ? "" : (r.label === "Sin dato" ? "" : r.label),
                  tipoOrden: ["Correctivo"],
                }),
              }))}
            />
          </div>
          {kpi4.ranking.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40"><tr>
                  {["Equipo", "Correctivos", "Hs. reales", "Hs. línea parada", ""].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {kpi4.ranking.map((r) => (
                    <tr key={r.label} className="border-t border-border hover:bg-accent/40">
                      <td className={td}>{r.label}</td>
                      <td className={`${td} tabular-nums font-semibold`}>{r.cant}</td>
                      <td className={`${td} tabular-nums`}>{r.horasReales.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                      <td className={`${td} tabular-nums`}>{r.horasParada.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                      <td className={td}>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => goResultados({
                          codigoEquipo: r.codigo || "", tipoOrden: ["Correctivo"],
                        })}>Ver OITs</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* KPI 5 detalle */}
        <Section
          id="kpi5"
          title="5 · Horas presupuestadas vs. horas reales"
          subtitle={`OITs con desvío significativo: más de 20% o más de 2 horas. ${kpi5.significativos} de ${kpi5.evaluadas} OITs con horas cargadas.`}
        >
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <div className="border border-border rounded-md p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Horas presupuestadas</div>
              <div className="text-2xl font-bold tabular-nums">{fmtH(kpi5.pres)}</div>
            </div>
            <div className="border border-border rounded-md p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Horas reales</div>
              <div className="text-2xl font-bold tabular-nums">{fmtH(kpi5.real)}</div>
            </div>
            <div className="border border-border rounded-md p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Desvío</div>
              <div className={`text-2xl font-bold tabular-nums ${kpi5.desv > 0 ? "text-destructive" : kpi5.desv < 0 ? "text-[hsl(var(--success))]" : ""}`}>
                {kpi5.desv > 0 ? "+" : ""}{kpi5.desv.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h
                <span className="text-sm ml-2">{kpi5.desvPct === null ? "N/A" : `${kpi5.desvPct > 0 ? "+" : ""}${kpi5.desvPct}%`}</span>
              </div>
            </div>
          </div>
          {kpi5.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay OITs con horas cargadas en el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40"><tr>
                  {["Nº OIT", "Equipo", "Tipo", "Responsable", "Hs. presup.", "Hs. reales", "Desvío hs.", "Desvío %", "Estado"].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {kpi5.top.map((r) => (
                    <tr
                      key={r.o.id}
                      onClick={() => abrirOIT(r.o.id)}
                      className={`border-t border-border cursor-pointer hover:bg-accent/40 ${r.significativo ? "bg-destructive/5" : ""}`}
                    >
                      <td className={`${td} font-medium`}>{r.o.nroOrden || "Sin dato"}</td>
                      <td className={td}>{equipoLabel(r.o)}</td>
                      <td className={td}>{dash(r.o.tipoOrden)}</td>
                      <td className={td}>{tecnicosDe(r.o).join(", ") || "Sin dato"}</td>
                      <td className={`${td} tabular-nums`}>{r.pres.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                      <td className={`${td} tabular-nums`}>{r.real.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                      <td className={`${td} tabular-nums font-semibold ${r.significativo ? (r.desv > 0 ? "text-destructive" : "text-[hsl(var(--warning))]") : ""}`}>
                        {r.desv > 0 ? "+" : ""}{r.desv.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`${td} tabular-nums`}>{r.desvPct === null ? "N/A" : `${r.desvPct > 0 ? "+" : ""}${Math.round(r.desvPct)}%`}</td>
                      <td className={td}>{dash(r.o.estado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </AppLayout>
  );
}
