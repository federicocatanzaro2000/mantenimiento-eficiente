import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, FileText, ExternalLink } from "lucide-react";
import { listRelevamientos, getOitNumerosMap } from "@/lib/relevamientos/api";
import { Relevamiento, RelevEstado, RelevPrioridad, PRIORIDAD_COLORS, ESTADO_COLORS, InvolucradoTipo } from "@/lib/relevamientos/types";
import { fetchProfilesMap } from "@/lib/ordenesApi";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<InvolucradoTipo, string> = { equipo: "Equipo", linea: "Línea", sector: "Sector" };

export default function RelevamientosPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Relevamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [oitMap, setOitMap] = useState<Record<string, number>>({});
  // filtros
  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState<string>("");
  const [fPrio, setFPrio] = useState<string>("");
  const [fTipo, setFTipo] = useState<string>("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [rels, profs] = await Promise.all([listRelevamientos(), fetchProfilesMap()]);
      setItems(rels);
      setProfiles(profs);
      const ids = rels.map((r) => r.oit_id).filter((x): x is string => !!x);
      if (ids.length) setOitMap(await getOitNumerosMap(ids));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (fEstado && r.estado !== fEstado) return false;
      if (fPrio && r.prioridad !== fPrio) return false;
      if (fTipo && r.involucrado_tipo !== fTipo) return false;
      if (fDesde && r.created_at.slice(0, 10) < fDesde) return false;
      if (fHasta && r.created_at.slice(0, 10) > fHasta) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const oitNro = r.oit_id ? String(oitMap[r.oit_id] ?? "") : "";
        const hay = [
          r.numero, r.solicitante, r.descripcion, r.involucrado_nombre, oitNro,
        ].join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, q, fEstado, fPrio, fTipo, fDesde, fHasta, oitMap]);

  const kpis = useMemo(() => ({
    total: filtered.length,
    pendientes: filtered.filter((r) => r.estado === "Pendiente").length,
    convertidos: filtered.filter((r) => r.estado === "Convertido en OIT").length,
    rechazados: filtered.filter((r) => r.estado === "Rechazado").length,
  }), [filtered]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Relevamientos</h1>
            <p className="text-sm text-muted-foreground">Registro de hallazgos detectados en planta.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => nav("/relevamientos/catalogo")}>Catálogo</Button>
            <Button onClick={() => nav("/relevamientos/nuevo")} className="gap-1">
              <Plus className="h-4 w-4" /> Nuevo relevamiento
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total" value={kpis.total} />
          <Kpi label="Pendientes" value={kpis.pendientes} color="bg-amber-500 text-white" />
          <Kpi label="Convertidos en OIT" value={kpis.convertidos} color="bg-emerald-600 text-white" />
          <Kpi label="Rechazados" value={kpis.rechazados} color="bg-muted text-muted-foreground" />
        </div>

        {/* Filtros */}
        <div className="bg-card border border-border rounded-md p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="N° REL/OIT, solicitante, descripción..." />
            </div>
          </div>
          <FilterSelect label="Estado" value={fEstado} onChange={setFEstado} options={["Pendiente", "Convertido en OIT", "Rechazado"]} />
          <FilterSelect label="Prioridad" value={fPrio} onChange={setFPrio} options={["Alta", "Media", "Baja"]} />
          <FilterSelect label="Tipo" value={fTipo} onChange={setFTipo} options={["equipo", "linea", "sector"]} render={(v) => TIPO_LABEL[v as InvolucradoTipo]} />
          <div>
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} className="h-9" />
          </div>
        </div>

        {/* Tabla desktop */}
        <div className="hidden md:block border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Involucrado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cargado por</TableHead>
                <TableHead>OIT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Sin relevamientos.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => nav(`/relevamientos/${r.id}`)}>
                  <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                  <TableCell className="text-xs">{r.created_at.slice(0, 10)}</TableCell>
                  <TableCell className="text-sm">{r.solicitante}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm">{r.descripcion}</TableCell>
                  <TableCell className="text-xs">
                    <span className="text-muted-foreground">{TIPO_LABEL[r.involucrado_tipo]}</span> · {r.involucrado_nombre}
                  </TableCell>
                  <TableCell><Badge className={cn(PRIORIDAD_COLORS[r.prioridad], "border-transparent")}>{r.prioridad}</Badge></TableCell>
                  <TableCell><Badge className={cn(ESTADO_COLORS[r.estado], "border-transparent")}>{r.estado}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{profiles[r.created_by] || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.oit_id && oitMap[r.oit_id] ? (
                      <Link to={`/orden/${r.oit_id}`} onClick={(e) => e.stopPropagation()} className="text-primary inline-flex items-center gap-1 hover:underline">
                        #{oitMap[r.oit_id]} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Tarjetas mobile */}
        <div className="md:hidden space-y-2">
          {loading ? <div className="text-center py-6 text-muted-foreground">Cargando...</div>
            : filtered.length === 0 ? <div className="text-center py-6 text-muted-foreground">Sin relevamientos.</div>
            : filtered.map((r) => (
            <button key={r.id} onClick={() => nav(`/relevamientos/${r.id}`)}
              className="w-full text-left bg-card border border-border rounded-md p-3 space-y-1 active:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{r.numero}</span>
                <div className="flex gap-1">
                  <Badge className={cn(PRIORIDAD_COLORS[r.prioridad], "border-transparent text-[10px]")}>{r.prioridad}</Badge>
                  <Badge className={cn(ESTADO_COLORS[r.estado], "border-transparent text-[10px]")}>{r.estado}</Badge>
                </div>
              </div>
              <div className="text-sm font-medium line-clamp-2">{r.descripcion}</div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{TIPO_LABEL[r.involucrado_tipo]} · {r.involucrado_nombre}</span>
                <span>{r.created_at.slice(0, 10)}</span>
              </div>
              <div className="text-xs text-muted-foreground">Solicitante: {r.solicitante}</div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold mt-1", color && "inline-block px-2 py-0.5 rounded", color)}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, render }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string;
}) {
  return (
    <div className="min-w-[130px]">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Todos</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{render ? render(o) : o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
