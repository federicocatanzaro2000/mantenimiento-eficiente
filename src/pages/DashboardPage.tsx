import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { EstadoOrden, Prioridad, TipoOrden, Filtros, filtrosVacios, Orden } from "@/types/orden";
import { SearchSelect, SearchOption } from "@/components/SearchSelect";
import { listSectors, listPeople, listEquipment, listOrderTypes, Person, Sector, Equipment, OrderType } from "@/lib/catalogos/api";
import { listPreventives } from "@/lib/preventiveManual/api";
import { PreventiveItem, effectiveStatus } from "@/lib/preventiveManual/types";
import {
  AlertTriangle, Clock, CheckCircle2, ListChecks, Activity, Flame, Timer, Wrench,
  RefreshCw, RotateCcw, Printer, Download, ChevronRight, Eye,
} from "lucide-react";
import { toast } from "sonner";

// ───────────────────────────────── helpers ─────────────────────────────────
const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
};
const isoOffset = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};
const inRange = (d: string, from: string, to: string) => {
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};
const fmtN = (n: number) => (Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "0");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const COLORS = {
  pendiente: "hsl(42 95% 50%)",
  proceso: "hsl(210 80% 48%)",
  cumplido: "hsl(142 65% 38%)",
  vencido: "hsl(0 75% 48%)",
  cancelado: "hsl(215 15% 55%)",
};
const TIPO_COLORS = ["hsl(217 91% 60%)", "hsl(0 75% 48%)", "hsl(262 60% 50%)", "hsl(142 65% 38%)", "hsl(42 95% 50%)"];

interface GFilters {
  desde: string;
  hasta: string;
  sector: string;
  tipo: TipoOrden | "";
  estado: EstadoOrden | "";
  prioridad: Prioridad | "";
  tecnico: string;
  solicitante: string;
  codigoEquipo: string;
  nombreEquipo: string;
}

const emptyG: GFilters = {
  desde: isoOffset(-30), hasta: today(),
  sector: "", tipo: "", estado: "", prioridad: "",
  tecnico: "", solicitante: "", codigoEquipo: "", nombreEquipo: "",
};

// ───────────────────────────────── KPI card ─────────────────────────────────
function Kpi({ title, value, sub, tone, icon: Icon, onClick }: {
  title: string; value: React.ReactNode; sub?: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success" | "info";
  icon?: any; onClick?: () => void;
}) {
  const ring =
    tone === "danger" ? "border-l-destructive" :
    tone === "warning" ? "border-l-[hsl(var(--warning))]" :
    tone === "success" ? "border-l-[hsl(var(--success))]" :
    tone === "info" ? "border-l-[hsl(var(--info))]" : "border-l-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-card border border-border rounded-md shadow-sm p-4 border-l-4 ${ring} ${onClick ? "hover:shadow-md hover:bg-accent/30 transition cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{title}</div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </button>
  );
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-secondary/40 rounded-t-md">
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

// ───────────────────────────────── main page ─────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const ordenes = useOrdenesStore((s) => s.ordenes);
  const loaded = useOrdenesStore((s) => s.loaded);
  const loadAll = useOrdenesStore((s) => s.loadAll);
  const setFiltros = useOrdenesStore((s) => s.setFiltros);

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [equipos, setEquipos] = useState<Equipment[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [preventivos, setPreventivos] = useState<PreventiveItem[]>([]);
  const [prevAvailable, setPrevAvailable] = useState<boolean>(true);

  const [g, setG] = useState<GFilters>(emptyG);
  const [tipoEquipoFilter, setTipoEquipoFilter] = useState<string>("");
  const setF = <K extends keyof GFilters>(k: K, v: GFilters[K]) => setG((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);

  const reload = async () => {
    try {
      const [s, p, e, t] = await Promise.all([listSectors(), listPeople(), listEquipment(), listOrderTypes()]);
      setSectors(s); setPeople(p); setEquipos(e); setOrderTypes(t);
    } catch (err: any) { toast.error("Error cargando catálogos: " + err.message); }
    try {
      const prev = await listPreventives({ activeOnly: true });
      setPreventivos(prev); setPrevAvailable(true);
    } catch { setPrevAvailable(false); setPreventivos([]); }
    await loadAll();
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // ───────── catalog options ─────────
  const optSectores = useMemo<SearchOption[]>(() =>
    sectors.filter((s) => s.active).map((s) => ({ value: s.name, label: s.name })), [sectors]);
  const optTecnicos = useMemo<SearchOption[]>(() =>
    people.filter((p) => p.can_be_technician).map((p) => ({ value: p.full_name, label: p.full_name, inactive: !p.active })), [people]);
  const optSolicitantes = useMemo<SearchOption[]>(() =>
    people.filter((p) => p.can_be_requester).map((p) => ({ value: p.full_name, label: p.full_name, inactive: !p.active })), [people]);
  const optCodigos = useMemo<SearchOption[]>(() =>
    equipos.filter((e) => e.active).map((e) => ({ value: e.code, label: `${e.code} — ${e.name}` })), [equipos]);
  const optEquipos = useMemo<SearchOption[]>(() => {
    const seen = new Set<string>(); const out: SearchOption[] = [];
    equipos.filter((e) => e.active).forEach((e) => { if (!seen.has(e.name)) { seen.add(e.name); out.push({ value: e.name, label: e.name }); } });
    return out;
  }, [equipos]);

  // ───────── apply filters ─────────
  const filtered = useMemo<Orden[]>(() => {
    const t = (v: string, q: string) => !q || (v ?? "").toLowerCase().includes(q.toLowerCase());
    return ordenes.filter((o) => {
      if (!inRange(o.fechaCreacion, g.desde, g.hasta)) return false;
      if (g.sector && o.sector !== g.sector) return false;
      if (g.tipo && o.tipoOrden !== g.tipo) return false;
      if (g.estado && o.estado !== g.estado) return false;
      if (g.prioridad && o.prioridad !== g.prioridad) return false;
      if (g.tecnico) {
        const arr = (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
          ? o.tecnicosResponsables
          : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []);
        if (!arr.some((x) => t(x, g.tecnico))) return false;
      }
      if (g.solicitante && !t(o.solicitante, g.solicitante)) return false;
      if (g.codigoEquipo && !t(o.codigoEquipo, g.codigoEquipo)) return false;
      if (g.nombreEquipo && !t(o.nombreEquipo, g.nombreEquipo)) return false;
      return true;
    });
  }, [ordenes, g]);

  // ───────── drill-down ─────────
  const goResultados = (patch: Partial<Filtros>) => {
    const base: Filtros = { ...filtrosVacios };
    base.fechaCreacionDesde = g.desde;
    base.fechaCreacionHasta = g.hasta;
    if (g.sector) base.sector = g.sector;
    if (g.tipo) base.tipoOrden = [g.tipo];
    if (g.estado) base.estado = [g.estado];
    if (g.prioridad) base.prioridad = [g.prioridad];
    if (g.tecnico) base.tecnicoResponsable = g.tecnico;
    if (g.solicitante) base.solicitante = g.solicitante;
    if (g.codigoEquipo) base.codigoEquipo = g.codigoEquipo;
    if (g.nombreEquipo) base.nombreEquipo = g.nombreEquipo;
    setFiltros({ ...base, ...patch });
    navigate("/resultados");
  };

  // ───────── computations ─────────
  const todayISO = today();
  const isClosed = (o: Orden) => o.estado === "Cumplido";
  const isOpen = (o: Orden) => o.estado === "Pendiente" || o.estado === "En proceso";
  const isOverdue = (o: Orden) => !!o.fechaLimiteRealizacion && o.fechaLimiteRealizacion < todayISO && !isClosed(o);
  const venceHoy = (o: Orden) => o.fechaLimiteRealizacion === todayISO && !isClosed(o);
  const vence7 = (o: Orden) => !!o.fechaLimiteRealizacion && o.fechaLimiteRealizacion >= todayISO && o.fechaLimiteRealizacion <= isoOffset(7) && !isClosed(o);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const abiertas = filtered.filter(isOpen).length;
    const cumplidas = filtered.filter(isClosed).length;
    const vencidas = filtered.filter(isOverdue).length;
    const altaAbiertas = filtered.filter((o) => o.prioridad === "Alta" && isOpen(o)).length;
    const enTermino = filtered.filter((o) => isClosed(o) && o.fechaFinalizacion && o.fechaLimiteRealizacion && o.fechaFinalizacion <= o.fechaLimiteRealizacion).length;
    const cumplPct = cumplidas ? Math.round((enTermino / cumplidas) * 100) : 0;
    const hPres = filtered.reduce((s, o) => s + (Number(o.horasPresupuestadas) || 0), 0);
    const hReal = filtered.reduce((s, o) => s + (Number(o.horasReales) || 0), 0);
    const desv = hReal - hPres;
    const desvPct = hPres > 0 ? Math.round((desv / hPres) * 100) : 0;
    const correctivasLineaParada = filtered.filter((o) => o.tipoOrden === "Correctivo" && o.lineStopped === true).length;
    const horasLineaParada = filtered.reduce((s, o) => s + (o.lineStopped === true ? (Number(o.lineStoppedHours) || 0) : 0), 0);
    return { total, abiertas, cumplidas, vencidas, altaAbiertas, cumplPct, hPres, hReal, desv, desvPct, correctivasLineaParada, horasLineaParada };
  }, [filtered]);

  // estado distribution
  const dataEstado = useMemo(() => {
    const estados: EstadoOrden[] = ["Pendiente", "En proceso", "Cumplido"];
    return estados.map((e) => ({
      estado: e,
      cantidad: filtered.filter((o) => o.estado === e).length,
      color: e === "Pendiente" ? COLORS.pendiente : e === "En proceso" ? COLORS.proceso : COLORS.cumplido,
    }));
  }, [filtered]);

  // tipos dinámicos: catálogo activo + tipos históricos que aparecen en datos filtrados
  const tiposDinamicos = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    orderTypes.filter((t) => t.active).forEach((t) => {
      const k = t.name.trim();
      if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
    });
    filtered.forEach((o) => {
      const k = String(o.tipoOrden ?? "").trim();
      if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
    });
    return out;
  }, [orderTypes, filtered]);

  // por tipo / sector / prioridad
  const dataTipo = useMemo(() => {
    return tiposDinamicos.map((t) => ({ tipo: t, cantidad: filtered.filter((o) => o.tipoOrden === t).length }));
  }, [filtered, tiposDinamicos]);

  const dataSector = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => { const k = o.sector || "Sin sector"; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([sector, cantidad]) => ({ sector, cantidad }));
  }, [filtered]);

  const dataPrioridad = useMemo(() => {
    const ps: Prioridad[] = ["Alta", "Media", "Baja"];
    return ps.map((p) => ({ prioridad: p, cantidad: filtered.filter((o) => o.prioridad === p).length }));
  }, [filtered]);

  // top equipos (con filtro local por tipo de OIT)
  const ordenesTopEquipos = useMemo<Orden[]>(
    () => (tipoEquipoFilter ? filtered.filter((o) => o.tipoOrden === tipoEquipoFilter) : filtered),
    [filtered, tipoEquipoFilter],
  );

  const topEquipos = useMemo(() => {
    const m = new Map<string, { codigo: string; nombre: string; total: number; abiertas: number; vencidas: number; horas: number; ultima: string }>();
    ordenesTopEquipos.forEach((o) => {
      const k = o.codigoEquipo || o.nombreEquipo || "Sin equipo";
      const cur = m.get(k) || { codigo: o.codigoEquipo || "", nombre: o.nombreEquipo || "Sin equipo", total: 0, abiertas: 0, vencidas: 0, horas: 0, ultima: "" };
      cur.total += 1;
      if (isOpen(o)) cur.abiertas += 1;
      if (isOverdue(o)) cur.vencidas += 1;
      cur.horas += Number(o.horasReales) || 0;
      if (o.fechaCreacion > cur.ultima) cur.ultima = o.fechaCreacion;
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [ordenesTopEquipos]);


  // carga por técnico
  const cargaTecnico = useMemo(() => {
    const m = new Map<string, { tecnico: string; total: number; abiertas: number; vencidas: number; cumplidas: number; enTermino: number; hPres: number; hReal: number }>();
    filtered.forEach((o) => {
      const techs = (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
        ? o.tecnicosResponsables
        : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []);
      const keys = techs.length > 0 ? techs : ["Sin asignar"];
      keys.forEach((k) => {
        const cur = m.get(k) || { tecnico: k, total: 0, abiertas: 0, vencidas: 0, cumplidas: 0, enTermino: 0, hPres: 0, hReal: 0 };
        cur.total += 1;
        if (isOpen(o)) cur.abiertas += 1;
        if (isOverdue(o)) cur.vencidas += 1;
        if (isClosed(o)) {
          cur.cumplidas += 1;
          if (o.fechaFinalizacion && o.fechaLimiteRealizacion && o.fechaFinalizacion <= o.fechaLimiteRealizacion) cur.enTermino += 1;
        }
        cur.hPres += Number(o.horasPresupuestadas) || 0;
        cur.hReal += Number(o.horasReales) || 0;
        m.set(k, cur);
      });
    });
    return Array.from(m.values()).sort((a, b) => b.abiertas - a.abiertas);
  }, [filtered]);

  // alertas tabla
  const alertasOrdenes = useMemo(() => {
    const score = (o: Orden) => {
      const lim = o.fechaLimiteRealizacion || "9999-12-31";
      const diff = Math.floor((new Date(lim).getTime() - new Date(todayISO).getTime()) / 86400000);
      const prio = o.prioridad === "Alta" ? 0 : o.prioridad === "Media" ? 1 : 2;
      return [prio, diff] as [number, number];
    };
    return filtered
      .filter((o) => isOpen(o) && (isOverdue(o) || venceHoy(o) || vence7(o) || o.prioridad === "Alta"))
      .sort((a, b) => { const sa = score(a), sb = score(b); return sa[0] - sb[0] || sa[1] - sb[1]; })
      .slice(0, 20);
  }, [filtered]);

  // OITs con parada de línea
  const oitsLineaParada = useMemo(() => {
    return filtered
      .filter((o) => o.lineStopped === true)
      .sort((a, b) => {
        const ha = Number(a.lineStoppedHours) || 0;
        const hb = Number(b.lineStoppedHours) || 0;
        if (hb !== ha) return hb - ha;
        const ra = Number(a.horasReales) || 0;
        const rb = Number(b.horasReales) || 0;
        return rb - ra;
      });
  }, [filtered]);

  const resumenLineaParada = useMemo(() => {
    return oitsLineaParada.reduce(
      (acc, o) => {
        acc.cantidad += 1;
        acc.horasParada += Number(o.lineStoppedHours) || 0;
        acc.horasPresupuestadas += Number(o.horasPresupuestadas) || 0;
        acc.horasReales += Number(o.horasReales) || 0;
        return acc;
      },
      { cantidad: 0, horasParada: 0, horasPresupuestadas: 0, horasReales: 0 },
    );
  }, [oitsLineaParada]);

  // horas pres vs real por tipo
  const horasPorTipo = useMemo(() => {
    return tiposDinamicos.map((t) => {
      const arr = filtered.filter((o) => o.tipoOrden === t);
      return {
        tipo: t,
        pres: arr.reduce((s, o) => s + (Number(o.horasPresupuestadas) || 0), 0),
        real: arr.reduce((s, o) => s + (Number(o.horasReales) || 0), 0),
      };
    });
  }, [filtered, tiposDinamicos]);

  // mayor desvío
  const mayoresDesvios = useMemo(() => {
    return filtered
      .filter((o) => Number(o.horasPresupuestadas) > 0 && Number(o.horasReales) > 0)
      .map((o) => {
        const desv = Number(o.horasReales) - Number(o.horasPresupuestadas);
        const pctD = Math.round((desv / Number(o.horasPresupuestadas)) * 100);
        return { o, desv, pctD };
      })
      .sort((a, b) => b.desv - a.desv)
      .slice(0, 10);
  }, [filtered]);

  // calidad
  const calidad = useMemo(() => {
    const t = filtered.length;
    const aprob = filtered.filter((o) => o.aprobado).length;
    const cc = filtered.filter((o) => o.controlLiberacionCalidad).length;
    const noApto = filtered.filter((o) => o.estadoRecepcionEquipo === "NO APTO").length;
    const sinResp = filtered.filter((o) => !o.responsableControlCalidad?.trim()).length;
    const sinFlujo = filtered.filter((o) => !o.elaboro || !o.reviso || !o.aprobo).length;
    return { t, aprob, cc, noApto, sinResp, sinFlujo };
  }, [filtered]);

  // calidad de datos
  const datos = useMemo(() => ({
    sinTecnico: filtered.filter((o) => {
      const arr = (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
        ? o.tecnicosResponsables
        : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []);
      return arr.length === 0;
    }).length,
    sinEquipo: filtered.filter((o) => {
      // Si el usuario respondió explícitamente "sin equipo", no es un dato faltante.
      if (o.projectHasEquipment === false) return false;
      return !o.codigoEquipo?.trim() && !o.nombreEquipo?.trim();
    }).length,
    sinLimite: filtered.filter((o) => !o.fechaLimiteRealizacion).length,
    sinPres: filtered.filter((o) => !o.horasPresupuestadas).length,
    sinTipo: filtered.filter((o) => !o.tipoOrden).length,
    sinSector: filtered.filter((o) => !o.sector?.trim()).length,
  }), [filtered]);

  // backlog
  const backlog = useMemo(() => {
    const abiertas = filtered.filter(isOpen);
    const buckets = { "0-7": 0, "8-15": 0, "16-30": 0, "+30": 0 };
    abiertas.forEach((o) => {
      const days = Math.floor((new Date(todayISO).getTime() - new Date(o.fechaCreacion || todayISO).getTime()) / 86400000);
      if (days <= 7) buckets["0-7"]++;
      else if (days <= 15) buckets["8-15"]++;
      else if (days <= 30) buckets["16-30"]++;
      else buckets["+30"]++;
    });
    return { abiertas, buckets };
  }, [filtered]);

  // evolución mensual
  const evolucion = useMemo(() => {
    const m = new Map<string, { mes: string; creadas: number; cumplidas: number; vencidas: number; horas: number }>();
    filtered.forEach((o) => {
      const k = (o.fechaCreacion || "").slice(0, 7);
      if (!k) return;
      const cur = m.get(k) || { mes: k, creadas: 0, cumplidas: 0, vencidas: 0, horas: 0 };
      cur.creadas += 1;
      if (isClosed(o)) cur.cumplidas += 1;
      if (isOverdue(o)) cur.vencidas += 1;
      cur.horas += Number(o.horasReales) || 0;
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [filtered]);

  // preventivos del período
  const prevs = useMemo(() => {
    const ps = preventivos.filter((p) => inRange(p.scheduled_date, g.desde, g.hasta));
    const proximos7 = preventivos.filter((p) => p.scheduled_date >= todayISO && p.scheduled_date <= isoOffset(7));
    const proximos30 = preventivos.filter((p) => p.scheduled_date >= todayISO && p.scheduled_date <= isoOffset(30));
    const vencidos = preventivos.filter((p) => effectiveStatus(p, todayISO) === "Vencido");
    const conOIT = preventivos.filter((p) => !!p.work_order_id).length;
    const sinOIT = preventivos.filter((p) => !p.work_order_id).length;
    const realizados = preventivos.filter((p) => p.status === "Realizado").length;
    const cancelados = preventivos.filter((p) => p.status === "Cancelado").length;
    return { total: ps.length, proximos7, proximos30, vencidos, conOIT, sinOIT, realizados, cancelados };
  }, [preventivos, g.desde, g.hasta, todayISO]);

  const proxPreventivos = useMemo(() =>
    [...preventivos]
      .filter((p) => effectiveStatus(p, todayISO) === "Vencido" || (p.scheduled_date >= todayISO && p.scheduled_date <= isoOffset(30)))
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
      .slice(0, 15),
  [preventivos, todayISO]);

  // ───────── presets ─────────
  const setPreset = (key: string) => {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (key === "30") setG((p) => ({ ...p, desde: isoOffset(-30), hasta: today() }));
    else if (key === "mes") setG((p) => ({ ...p, desde: fmt(new Date(y, mo, 1)), hasta: today() }));
    else if (key === "mes-1") setG((p) => ({ ...p, desde: fmt(new Date(y, mo - 1, 1)), hasta: fmt(new Date(y, mo, 0)) }));
    else if (key === "anio") setG((p) => ({ ...p, desde: fmt(new Date(y, 0, 1)), hasta: today() }));
    else if (key === "anio-1") setG((p) => ({ ...p, desde: fmt(new Date(y - 1, 0, 1)), hasta: fmt(new Date(y - 1, 11, 31)) }));
  };

  // ───────── export ─────────
  const exportCSV = () => {
    const headers = ["Nro", "F.Creación", "F.Límite", "Estado", "Prioridad", "Tipo", "Sector", "Equipo", "Técnico", "Hs.Pres", "Hs.Real"];
    const rows = filtered.map((o) => [
      o.nroOrden, o.fechaCreacion, o.fechaLimiteRealizacion, o.estado, o.prioridad, o.tipoOrden, o.sector,
      `${o.codigoEquipo} ${o.nombreEquipo}`.trim(), o.tecnicoResponsable, o.horasPresupuestadas, o.horasReales,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `INCALFOOD_Dashboard_${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const diasHasta = (d: string) => Math.floor((new Date(d).getTime() - new Date(todayISO).getTime()) / 86400000);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-3 no-print">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Dashboard Operativo</h2>
            <p className="text-sm text-muted-foreground">Mantenimiento — Incalfood. Datos del período {g.desde || "—"} → {g.hasta || "hoy"}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reload} className="gap-1.5"><RefreshCw className="h-4 w-4" />Refrescar</Button>
            <Button variant="outline" size="sm" onClick={() => setG(emptyG)} className="gap-1.5"><RotateCcw className="h-4 w-4" />Limpiar</Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5"><Download className="h-4 w-4" />Exportar</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" />Imprimir</Button>
          </div>
        </div>

        {/* filtros */}
        <Section title="Filtros globales" subtitle="Se aplican a todo el tablero">
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { k: "30", l: "Últimos 30 días" }, { k: "mes", l: "Este mes" }, { k: "mes-1", l: "Mes anterior" },
              { k: "anio", l: "Este año" }, { k: "anio-1", l: "Año anterior" },
            ].map((p) => (
              <Button key={p.k} variant="outline" size="sm" onClick={() => setPreset(p.k)}>{p.l}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div><Label className="text-xs">Desde</Label><Input type="date" value={g.desde} onChange={(e) => setF("desde", e.target.value)} className="h-9" /></div>
            <div><Label className="text-xs">Hasta</Label><Input type="date" value={g.hasta} onChange={(e) => setF("hasta", e.target.value)} className="h-9" /></div>
            <div><Label className="text-xs">Sector</Label><SearchSelect value={g.sector} onChange={(v) => setF("sector", v)} options={optSectores} placeholder="Todos" /></div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <SearchSelect value={g.tipo} onChange={(v) => setF("tipo", v as any)}
                options={tiposDinamicos.map((t) => ({ value: t, label: t }))}
                placeholder="Todos" />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <SearchSelect value={g.estado} onChange={(v) => setF("estado", v as any)}
                options={[{ value: "Pendiente", label: "Pendiente" }, { value: "En proceso", label: "En proceso" }, { value: "Cumplido", label: "Cumplido" }]}
                placeholder="Todos" />
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <SearchSelect value={g.prioridad} onChange={(v) => setF("prioridad", v as any)}
                options={[{ value: "Alta", label: "Alta" }, { value: "Media", label: "Media" }, { value: "Baja", label: "Baja" }]}
                placeholder="Todas" />
            </div>
            <div><Label className="text-xs">Técnico responsable</Label><SearchSelect value={g.tecnico} onChange={(v) => setF("tecnico", v)} options={optTecnicos} placeholder="Todos" /></div>
            <div><Label className="text-xs">Solicitante</Label><SearchSelect value={g.solicitante} onChange={(v) => setF("solicitante", v)} options={optSolicitantes} placeholder="Todos" /></div>
            <div><Label className="text-xs">Código equipo</Label><SearchSelect value={g.codigoEquipo} onChange={(v) => setF("codigoEquipo", v)} options={optCodigos} placeholder="Todos" /></div>
            <div><Label className="text-xs">Nombre equipo</Label><SearchSelect value={g.nombreEquipo} onChange={(v) => setF("nombreEquipo", v)} options={optEquipos} placeholder="Todos" /></div>
          </div>
        </Section>

        {/* KPIs ejecutivos */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Kpi title="Total OITs" value={fmtN(kpis.total)} icon={ListChecks} onClick={() => goResultados({})} />
          <Kpi title="Abiertas" value={fmtN(kpis.abiertas)} sub={`${pct(kpis.abiertas, kpis.total)}% del total`} tone="info" icon={Activity}
            onClick={() => goResultados({ estado: ["Pendiente", "En proceso"] })} />
          <Kpi title="Vencidas" value={fmtN(kpis.vencidas)} sub={`${pct(kpis.vencidas, kpis.abiertas)}% de abiertas`} tone="danger" icon={AlertTriangle}
            onClick={() => goResultados({ estado: ["Pendiente", "En proceso"], fechaLimiteHasta: isoOffset(-1) })} />
          <Kpi title="Cumplidas" value={fmtN(kpis.cumplidas)} sub={`${pct(kpis.cumplidas, kpis.total)}% del total`} tone="success" icon={CheckCircle2}
            onClick={() => goResultados({ estado: ["Cumplido"] })} />
          <Kpi title="Cumplimiento en término" value={`${kpis.cumplPct}%`} sub={`Sobre ${kpis.cumplidas} cumplidas`} tone="success" icon={Timer} />
          <Kpi title="Alta prioridad abiertas" value={fmtN(kpis.altaAbiertas)} tone="danger" icon={Flame}
            onClick={() => goResultados({ prioridad: ["Alta"], estado: ["Pendiente", "En proceso"] })} />
          <Kpi title="Horas presupuestadas" value={fmtN(kpis.hPres)} icon={Clock} />
          <Kpi title="Horas reales" value={fmtN(kpis.hReal)} icon={Clock} />
          <Kpi title="Desvío de horas" value={`${kpis.desv >= 0 ? "+" : ""}${fmtN(kpis.desv)}`}
            sub={`${kpis.desvPct >= 0 ? "+" : ""}${kpis.desvPct}% vs presupuestadas`}
            tone={kpis.desv > 0 ? "danger" : kpis.desv < 0 ? "success" : "default"} icon={Activity} />
          <Kpi title="Preventivos próx. 7 días" value={prevAvailable ? fmtN(prevs.proximos7.length) : "—"}
            sub={prevAvailable ? `${prevs.vencidos.length} vencidos` : "Sin módulo"} tone={prevs.vencidos.length > 0 ? "warning" : "default"} icon={Wrench}
            onClick={prevAvailable ? () => navigate("/preventivos") : undefined} />
          <Kpi title="Correctivas con línea parada" value={fmtN(kpis.correctivasLineaParada)} tone={kpis.correctivasLineaParada > 0 ? "danger" : "default"} icon={AlertTriangle}
            onClick={() => goResultados({ tipoOrden: ["Correctivo"], lineStopped: "Si" })} />
          <Kpi title="Horas de línea parada" value={fmtN(kpis.horasLineaParada)} sub="Total del período" tone={kpis.horasLineaParada > 0 ? "danger" : "default"} icon={Clock} />
        </div>

        {/* alertas operativas */}
        <Section title="Alertas operativas" subtitle="Órdenes que requieren atención inmediata">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi title="Vencidas" value={kpis.vencidas} tone="danger"
              onClick={() => goResultados({ estado: ["Pendiente", "En proceso"], fechaLimiteHasta: isoOffset(-1) })} />
            <Kpi title="Vencen hoy" value={filtered.filter(venceHoy).length} tone="warning"
              onClick={() => goResultados({ estado: ["Pendiente", "En proceso"], fechaLimiteDesde: todayISO, fechaLimiteHasta: todayISO })} />
            <Kpi title="Vencen en 7 días" value={filtered.filter(vence7).length} tone="warning"
              onClick={() => goResultados({ estado: ["Pendiente", "En proceso"], fechaLimiteDesde: todayISO, fechaLimiteHasta: isoOffset(7) })} />
            <Kpi title="Alta prioridad pendientes" value={kpis.altaAbiertas} tone="danger"
              onClick={() => goResultados({ prioridad: ["Alta"], estado: ["Pendiente", "En proceso"] })} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  {["Nro", "F. Límite", "Días", "Estado", "Prioridad", "Sector", "Equipo", "Técnico", ""].map((h, i) =>
                    <th key={i} className="text-left p-2 text-xs font-medium uppercase tracking-wide">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {alertasOrdenes.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Sin alertas en el período</td></tr>}
                {alertasOrdenes.map((o) => {
                  const d = o.fechaLimiteRealizacion ? diasHasta(o.fechaLimiteRealizacion) : null;
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-accent/30">
                      <td className="p-2 font-mono font-semibold">{o.nroOrden}</td>
                      <td className="p-2">{o.fechaLimiteRealizacion || "—"}</td>
                      <td className={`p-2 font-medium ${d != null && d < 0 ? "text-destructive" : d != null && d <= 7 ? "text-[hsl(var(--warning))]" : ""}`}>
                        {d == null ? "—" : d < 0 ? `${Math.abs(d)}d vencida` : d === 0 ? "Hoy" : `en ${d}d`}
                      </td>
                      <td className="p-2">{o.estado}</td>
                      <td className="p-2">{o.prioridad}</td>
                      <td className="p-2">{o.sector || "—"}</td>
                      <td className="p-2">{[o.codigoEquipo, o.nombreEquipo].filter(Boolean).join(" — ") || "—"}</td>
                      <td className="p-2">{o.tecnicoResponsable || "Sin asignar"}</td>
                      <td className="p-2"><Button size="icon" variant="ghost" onClick={() => navigate(`/orden/${o.id}`)}><Eye className="h-4 w-4" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* estado + tipo + prioridad */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Estado de órdenes">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataEstado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="estado" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} onClick={(d: any) => goResultados({ estado: [d.estado] })} cursor="pointer">
                    {dataEstado.map((d) => <Cell key={d.estado} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Por tipo de orden">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataTipo.filter((d) => d.cantidad > 0)} dataKey="cantidad" nameKey="tipo" outerRadius={85} label
                    onClick={(d: any) => goResultados({ tipoOrden: [d.tipo] })} cursor="pointer">
                    {dataTipo.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Por prioridad">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPrioridad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="prioridad" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} onClick={(d: any) => goResultados({ prioridad: [d.prioridad] })} cursor="pointer">
                    <Cell fill="hsl(0 75% 48%)" /><Cell fill="hsl(42 95% 50%)" /><Cell fill="hsl(215 15% 55%)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        {/* sector + backlog */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Órdenes por sector">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataSector} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="sector" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="hsl(215 60% 45%)" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(d: any) => goResultados({ sector: d.sector })} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Backlog (OITs abiertas)" subtitle={`Total: ${backlog.abiertas.length}`}>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {Object.entries(backlog.buckets).map(([k, v]) => (
                <div key={k} className="border border-border rounded-md p-3 text-center bg-secondary/30">
                  <div className="text-xs text-muted-foreground">{k} días</div>
                  <div className="text-2xl font-bold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary sticky top-0">
                  <tr>{["Nro", "F.Creación", "Días", "Prioridad", "Sector", "Técnico"].map((h) =>
                    <th key={h} className="text-left p-2 text-xs uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {backlog.abiertas.slice(0, 30).map((o) => {
                    const days = Math.floor((new Date(todayISO).getTime() - new Date(o.fechaCreacion || todayISO).getTime()) / 86400000);
                    return (
                      <tr key={o.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => navigate(`/orden/${o.id}`)}>
                        <td className="p-2 font-mono">{o.nroOrden}</td><td className="p-2">{o.fechaCreacion}</td>
                        <td className="p-2">{days}</td><td className="p-2">{o.prioridad}</td>
                        <td className="p-2">{o.sector || "—"}</td><td className="p-2">{o.tecnicoResponsable || "Sin asignar"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* equipos críticos */}
        <Section
          title="Equipos con mayor intervención (Top 10)"
          subtitle={`Identifica máquinas problemáticas${tipoEquipoFilter ? ` · Tipo: ${tipoEquipoFilter}` : ""}`}
          action={
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label className="text-xs whitespace-nowrap text-muted-foreground">Tipo de OIT</Label>
              <div className="w-full sm:w-56">
                <SearchSelect
                  value={tipoEquipoFilter}
                  onChange={setTipoEquipoFilter}
                  options={tiposDinamicos.map((t) => ({ value: t, label: t }))}
                  placeholder="Todos los tipos"
                />
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>{["Código", "Equipo", "OITs", "Abiertas", "Vencidas", "Hs. reales", "Última OIT", ""].map((h) =>
                  <th key={h} className="text-left p-2 text-xs uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {topEquipos.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">{tipoEquipoFilter ? "Sin datos para el tipo de OIT seleccionado" : "Sin datos"}</td></tr>}
                {topEquipos.map((e, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/30">
                    <td className="p-2 font-mono">{e.codigo || "—"}</td>
                    <td className="p-2">{e.nombre}</td>
                    <td className="p-2 font-semibold">{e.total}</td>
                    <td className="p-2 text-[hsl(var(--info))]">{e.abiertas}</td>
                    <td className={`p-2 ${e.vencidas > 0 ? "text-destructive font-medium" : ""}`}>{e.vencidas}</td>
                    <td className="p-2 tabular-nums">{fmtN(e.horas)}</td>
                    <td className="p-2">{e.ultima || "—"}</td>
                    <td className="p-2">
                      <Button size="sm" variant="ghost" className="gap-1"
                        onClick={() => goResultados({
                          codigoEquipo: e.codigo,
                          nombreEquipo: e.codigo ? "" : e.nombre,
                          ...(tipoEquipoFilter ? { tipoOrden: [tipoEquipoFilter] } : {}),
                        })}>
                        Ver <ChevronRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* carga por técnico */}
        <Section title="Carga por técnico responsable">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>{["Técnico", "Total", "Abiertas", "Vencidas", "Cumplidas", "% en término", "Hs. Pres", "Hs. Real", "Desvío", ""].map((h) =>
                  <th key={h} className="text-left p-2 text-xs uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {cargaTecnico.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">Sin datos</td></tr>}
                {cargaTecnico.map((t) => {
                  const desv = t.hReal - t.hPres;
                  return (
                    <tr key={t.tecnico} className="border-t border-border hover:bg-accent/30">
                      <td className="p-2 font-medium">{t.tecnico}</td>
                      <td className="p-2">{t.total}</td>
                      <td className="p-2 text-[hsl(var(--info))]">{t.abiertas}</td>
                      <td className={`p-2 ${t.vencidas > 0 ? "text-destructive font-medium" : ""}`}>{t.vencidas}</td>
                      <td className="p-2 text-[hsl(var(--success))]">{t.cumplidas}</td>
                      <td className="p-2">{t.cumplidas ? Math.round((t.enTermino / t.cumplidas) * 100) : 0}%</td>
                      <td className="p-2 tabular-nums">{fmtN(t.hPres)}</td>
                      <td className="p-2 tabular-nums">{fmtN(t.hReal)}</td>
                      <td className={`p-2 tabular-nums ${desv > 0 ? "text-destructive" : desv < 0 ? "text-[hsl(var(--success))]" : ""}`}>
                        {desv >= 0 ? "+" : ""}{fmtN(desv)}
                      </td>
                      <td className="p-2">
                        <Button size="sm" variant="ghost" className="gap-1"
                          onClick={() => goResultados({ tecnicoResponsable: t.tecnico === "Sin asignar" ? "" : t.tecnico })}>
                          Ver <ChevronRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* horas pres vs real */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Horas presupuestadas vs reales por tipo">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horasPorTipo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="tipo" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip /><Legend />
                  <Bar dataKey="pres" name="Presupuestadas" fill="hsl(215 60% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="real" name="Reales" fill="hsl(0 75% 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Mayores desvíos por OIT">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary sticky top-0">
                  <tr>{["Nro", "Tipo", "Equipo", "Pres", "Real", "Desvío", "%"].map((h) =>
                    <th key={h} className="text-left p-2 text-xs uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {mayoresDesvios.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sin datos</td></tr>}
                  {mayoresDesvios.map(({ o, desv, pctD }) => (
                    <tr key={o.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => navigate(`/orden/${o.id}`)}>
                      <td className="p-2 font-mono">{o.nroOrden}</td>
                      <td className="p-2">{o.tipoOrden}</td>
                      <td className="p-2">{[o.codigoEquipo, o.nombreEquipo].filter(Boolean).join(" — ") || "—"}</td>
                      <td className="p-2 tabular-nums">{o.horasPresupuestadas}</td>
                      <td className="p-2 tabular-nums">{o.horasReales}</td>
                      <td className="p-2 tabular-nums text-destructive font-medium">+{desv}</td>
                      <td className="p-2 text-destructive">+{pctD}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* evolución mensual */}
        <Section title="Evolución mensual" subtitle="OITs creadas, cumplidas y vencidas por mes">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="creadas" name="Creadas" stroke="hsl(215 60% 45%)" strokeWidth={2} />
                <Line type="monotone" dataKey="cumplidas" name="Cumplidas" stroke="hsl(142 65% 38%)" strokeWidth={2} />
                <Line type="monotone" dataKey="vencidas" name="Vencidas" stroke="hsl(0 75% 48%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* calidad */}
        <Section title="Calidad y aprobaciones">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Kpi title="Aprobadas" value={calidad.aprob} sub={`${pct(calidad.aprob, calidad.t)}%`} tone="success" />
            <Kpi title="No aprobadas" value={calidad.t - calidad.aprob} sub={`${pct(calidad.t - calidad.aprob, calidad.t)}%`} tone="warning" />
            <Kpi title="Con control calidad" value={calidad.cc} sub={`${pct(calidad.cc, calidad.t)}%`} tone="info" />
            <Kpi title="Recepción NO APTO" value={calidad.noApto} tone={calidad.noApto > 0 ? "danger" : "default"} />
            <Kpi title="Sin responsable calidad" value={calidad.sinResp} tone="warning" />
            <Kpi title="Sin elaboró/revisó/aprobó" value={calidad.sinFlujo} tone="warning" />
          </div>
        </Section>

        {/* preventivos */}
        <Section title="Preventivos" subtitle={prevAvailable ? "Próximos y vencidos" : "Módulo no disponible"}>
          {!prevAvailable ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay datos de preventivos disponibles.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
                <Kpi title="Del período" value={prevs.total} onClick={() => navigate("/preventivos")} />
                <Kpi title="Próx. 7 días" value={prevs.proximos7.length} tone="warning" onClick={() => navigate("/preventivos")} />
                <Kpi title="Próx. 30 días" value={prevs.proximos30.length} tone="info" onClick={() => navigate("/preventivos")} />
                <Kpi title="Vencidos" value={prevs.vencidos.length} tone={prevs.vencidos.length > 0 ? "danger" : "default"} onClick={() => navigate("/preventivos")} />
                <Kpi title="Con OIT" value={prevs.conOIT} tone="success" />
                <Kpi title="Sin OIT" value={prevs.sinOIT} tone="warning" />
                <Kpi title="Realizados" value={prevs.realizados} tone="success" />
                <Kpi title="Cancelados" value={prevs.cancelados} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>{["F. Programada", "Código", "Equipo", "Tarea", "Estado", "OIT", ""].map((h) =>
                      <th key={h} className="text-left p-2 text-xs uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {proxPreventivos.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sin preventivos próximos</td></tr>}
                    {proxPreventivos.map((p) => {
                      const st = effectiveStatus(p, todayISO);
                      return (
                        <tr key={p.id} className="border-t border-border hover:bg-accent/30">
                          <td className={`p-2 font-mono ${st === "Vencido" ? "text-destructive font-medium" : ""}`}>{p.scheduled_date}</td>
                          <td className="p-2">{p.equipment_code_snapshot}</td>
                          <td className="p-2">{p.equipment_name_snapshot}</td>
                          <td className="p-2">{p.task_name}</td>
                          <td className="p-2">{st}</td>
                          <td className="p-2">{p.work_order_id ? "Sí" : "—"}</td>
                          <td className="p-2"><Button size="sm" variant="ghost" onClick={() => navigate("/preventivos")}>Ver</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>

        {/* calidad de datos */}
        <Section title="Calidad de datos" subtitle="Mejora la disciplina de carga">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi title="Sin técnico" value={datos.sinTecnico} tone={datos.sinTecnico > 0 ? "warning" : "default"} />
            <Kpi title="Sin equipo" value={datos.sinEquipo} tone={datos.sinEquipo > 0 ? "warning" : "default"} />
            <Kpi title="Sin fecha límite" value={datos.sinLimite} tone={datos.sinLimite > 0 ? "warning" : "default"} />
            <Kpi title="Sin hs. presup." value={datos.sinPres} tone={datos.sinPres > 0 ? "warning" : "default"} />
            <Kpi title="Sin tipo" value={datos.sinTipo} tone={datos.sinTipo > 0 ? "warning" : "default"} />
            <Kpi title="Sin sector" value={datos.sinSector} tone={datos.sinSector > 0 ? "warning" : "default"} />
          </div>
        </Section>

        {/* Asociación a equipos */}
        {(() => {
          const total = filtered.length;
          const conEq = filtered.filter((o) => o.projectHasEquipment === true || (o.projectHasEquipment == null && (o.codigoEquipo?.trim() || o.nombreEquipo?.trim())));
          const sinEq = filtered.filter((o) => o.projectHasEquipment === false || (o.projectHasEquipment == null && !o.codigoEquipo?.trim() && !o.nombreEquipo?.trim()));
          const pctCon = total > 0 ? Math.round((conEq.length / total) * 100) : 0;
          const pctSin = total > 0 ? Math.round((sinEq.length / total) * 100) : 0;
          return (
            <Section title="Asociación a equipos" subtitle="Distribución de OITs según si están asociadas a un equipo">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi title="Total OITs" value={total} />
                <Kpi title="Con equipo asociado" value={conEq.length} sub={`${pctCon}% del total`} onClick={() => goResultados({ projectEquipo: "ConEquipo" } as any)} />
                <Kpi title="Sin equipo asociado" value={sinEq.length} sub={`${pctSin}% del total`} onClick={() => goResultados({ projectEquipo: "SinEquipo" } as any)} />
                <Kpi title="% con equipo" value={`${pctCon}%`} />
              </div>
            </Section>
          );
        })()}
      </div>
    </AppLayout>
  );
}
