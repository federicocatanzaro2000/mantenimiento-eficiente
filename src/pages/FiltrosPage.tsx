import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { Filtros, filtrosVacios, EstadoOrden, Prioridad, TipoOrden } from "@/types/orden";
import { filtersToParams, paramsToFilters, hasActiveFilters } from "@/lib/filtersUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aplicarFiltros } from "@/lib/filterOrdenes";
import { ArrowLeft, Filter as FilterIcon, RotateCcw } from "lucide-react";
import { SearchSelect, SearchOption } from "@/components/SearchSelect";
import {
  listPeople, listSectors, listEquipment, listOrderTypes, listDocumentCodes,
  Person, Sector as SectorCat, Equipment, PersonField, OrderType, DocumentCode,
} from "@/lib/catalogos/api";
import { toast } from "sonner";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">{title}</h3>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}
const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}</div>
);

const RangoFechas = ({ desde, hasta, onDesde, onHasta }: any) => (
  <div className="flex gap-2">
    <Input type="date" value={desde} onChange={(e) => onDesde(e.target.value)} />
    <Input type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} />
  </div>
);

const RangoNum = ({ min, max, onMin, onMax }: any) => (
  <div className="flex gap-2">
    <Input type="number" placeholder="Min" value={min} onChange={(e) => onMin(e.target.value)} />
    <Input type="number" placeholder="Max" value={max} onChange={(e) => onMax(e.target.value)} />
  </div>
);

function MultiCheck<T extends string>({ opciones, valores, onChange }: { opciones: T[]; valores: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {opciones.map((o) => (
        <label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Checkbox
            checked={valores.includes(o)}
            onCheckedChange={(c) => onChange(c ? [...valores, o] : valores.filter((v) => v !== o))}
          />
          {o}
        </label>
      ))}
    </div>
  );
}

// Build combined options: catalog (active first) + historic values from ordenes
function buildPersonOptions(people: Person[], field: PersonField, historic: Set<string>): SearchOption[] {
  const opts: SearchOption[] = [];
  const seen = new Set<string>();
  people
    .filter((p) => p[field])
    .sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name))
    .forEach((p) => {
      const k = p.full_name.trim();
      if (!k || seen.has(k.toLowerCase())) return;
      seen.add(k.toLowerCase());
      opts.push({ value: k, label: k, inactive: !p.active });
    });
  // historic snapshots not in catalog
  historic.forEach((h) => {
    const k = h.trim();
    if (!k || seen.has(k.toLowerCase())) return;
    seen.add(k.toLowerCase());
    opts.push({ value: k, label: k, inactive: true });
  });
  return opts;
}

function buildSectorOptions(sectors: SectorCat[], historic: Set<string>): SearchOption[] {
  const opts: SearchOption[] = [];
  const seen = new Set<string>();
  sectors
    .sort((a, b) => Number(b.active) - Number(a.active) || a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .forEach((s) => {
      const k = s.name.trim();
      if (!k || seen.has(k.toLowerCase())) return;
      seen.add(k.toLowerCase());
      opts.push({ value: k, label: k, inactive: !s.active });
    });
  historic.forEach((h) => {
    const k = h.trim();
    if (!k || seen.has(k.toLowerCase())) return;
    seen.add(k.toLowerCase());
    opts.push({ value: k, label: k, inactive: true });
  });
  return opts;
}

export default function FiltrosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ordenes, filtros, setFiltros, resetFiltros, loaded, loadAll } = useOrdenesStore();
  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);
  // Source of truth on entry: URL params > store filtros > vacios
  const initial = useMemo<Filtros>(() => {
    if (Array.from(searchParams.keys()).length > 0) return paramsToFilters(searchParams);
    if (hasActiveFilters(filtros)) return filtros;
    return filtrosVacios;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [local, setLocal] = useState<Filtros>(initial);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setLocal((p) => ({ ...p, [k]: v }));
  const preview = useMemo(() => aplicarFiltros(ordenes, local).length, [ordenes, local]);

  // Catalogs
  const [people, setPeople] = useState<Person[]>([]);
  const [sectors, setSectors] = useState<SectorCat[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  useEffect(() => {
    Promise.all([listPeople(), listSectors(), listEquipment(), listOrderTypes()])
      .then(([p, s, e, t]) => { setPeople(p); setSectors(s); setEquipment(e); setOrderTypes(t); })
      .catch((err) => toast.error("Error cargando catálogos: " + err.message));
  }, []);

  // Tipo options: active catalog types + historical types still present in OITs
  const optTiposOrden = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    orderTypes.filter((t) => t.active).forEach((t) => {
      const k = t.name.trim();
      if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
    });
    ordenes.forEach((o) => {
      const k = String(o.tipoOrden ?? "").trim();
      if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
    });
    return out;
  }, [orderTypes, ordenes]);

  // Historic snapshot sets from existing ordenes
  const hist = useMemo(() => {
    const collect = (key: keyof typeof ordenes[number]) => {
      const s = new Set<string>();
      ordenes.forEach((o) => { const v = (o as any)[key]; if (v && typeof v === "string") s.add(v); });
      return s;
    };
    return {
      solicitante: collect("solicitante"),
      tecnico: (() => {
        const s = new Set<string>();
        ordenes.forEach((o) => {
          const arr = (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
            ? o.tecnicosResponsables
            : (o.tecnicoResponsable ? o.tecnicoResponsable.split(",").map((x) => x.trim()) : []);
          arr.forEach((t) => { if (t) s.add(t); });
        });
        return s;
      })(),
      calidad: collect("responsableControlCalidad"),
      elaboro: collect("elaboro"),
      reviso: collect("reviso"),
      aprobo: collect("aprobo"),
      sector: collect("sector"),
      codigoEquipo: collect("codigoEquipo"),
      nombreEquipo: collect("nombreEquipo"),
    };
  }, [ordenes]);

  // Nro orden options from existing ordenes
  const optNroOrden = useMemo(() => {
    const map = new Map<string, string>();
    ordenes.forEach((o) => {
      const n = String(o.nroOrden ?? "").trim();
      if (n && n !== "0" && n !== "") map.set(n, n);
    });
    return Array.from(map.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [ordenes]);

  // Person option lists
  const optSolicitante = useMemo(() => buildPersonOptions(people, "can_be_requester", hist.solicitante), [people, hist.solicitante]);
  const optTecnico = useMemo(() => buildPersonOptions(people, "can_be_technician", hist.tecnico), [people, hist.tecnico]);
  const optCalidad = useMemo(() => buildPersonOptions(people, "can_be_quality_responsible", hist.calidad), [people, hist.calidad]);
  const optElaboro = useMemo(() => buildPersonOptions(people, "can_be_created_by", hist.elaboro), [people, hist.elaboro]);
  const optReviso = useMemo(() => buildPersonOptions(people, "can_be_reviewed_by", hist.reviso), [people, hist.reviso]);
  const optAprobo = useMemo(() => buildPersonOptions(people, "can_be_approver", hist.aprobo), [people, hist.aprobo]);
  const optSector = useMemo(() => buildSectorOptions(sectors, hist.sector), [sectors, hist.sector]);

  // Equipment linked code <-> name
  const equipOpts = useMemo(() => {
    // active first, then inactive; build code & name option sets
    const codeMap = new Map<string, { name: string; inactive: boolean }>();
    const nameSet = new Map<string, boolean>(); // name -> inactive flag (false wins)
    equipment.forEach((e) => {
      const code = e.code.trim(); const name = e.name.trim();
      if (code && !codeMap.has(code.toLowerCase())) codeMap.set(code.toLowerCase(), { name, inactive: !e.active });
      if (name) {
        const prev = nameSet.get(name.toLowerCase());
        nameSet.set(name.toLowerCase(), prev === false ? false : !e.active);
      }
    });
    // historic
    hist.codigoEquipo.forEach((c) => {
      const k = c.trim().toLowerCase();
      if (k && !codeMap.has(k)) codeMap.set(k, { name: "", inactive: true });
    });
    hist.nombreEquipo.forEach((n) => {
      const k = n.trim().toLowerCase();
      if (k && !nameSet.has(k)) nameSet.set(k, true);
    });

    // Selected name -> filter codes
    const selectedName = local.nombreEquipo.trim().toLowerCase();
    const selectedCode = local.codigoEquipo.trim().toLowerCase();

    const codeOptions: SearchOption[] = equipment
      .filter((e) => !selectedName || e.name.trim().toLowerCase() === selectedName)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code))
      .map((e) => ({
        value: e.code.trim(),
        label: `${e.code.trim()} - ${e.name.trim()}`,
        inactive: !e.active,
      }));
    // historic codes (no name match available -> include only when no name selected)
    if (!selectedName) {
      hist.codigoEquipo.forEach((c) => {
        const k = c.trim();
        if (k && !equipment.some((e) => e.code.trim().toLowerCase() === k.toLowerCase())) {
          codeOptions.push({ value: k, label: k, inactive: true });
        }
      });
    }

    // Name options - unique names; if a code is selected, restrict to that code's name
    const selectedCodeEntry = equipment.find((e) => e.code.trim().toLowerCase() === selectedCode);
    const nameOptions: SearchOption[] = [];
    const seenNames = new Set<string>();
    const pushName = (n: string, inactive: boolean) => {
      const k = n.trim(); if (!k || seenNames.has(k.toLowerCase())) return;
      seenNames.add(k.toLowerCase()); nameOptions.push({ value: k, label: k, inactive });
    };
    if (selectedCodeEntry) {
      pushName(selectedCodeEntry.name, !selectedCodeEntry.active);
    } else {
      equipment
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
        .forEach((e) => pushName(e.name, !e.active));
      hist.nombreEquipo.forEach((n) => pushName(n, true));
    }

    return { codeOptions, nameOptions };
  }, [equipment, hist.codigoEquipo, hist.nombreEquipo, local.codigoEquipo, local.nombreEquipo]);

  // When picking a code, auto-set name if empty/inconsistent
  const onCodigoEquipo = (v: string) => {
    const e = equipment.find((x) => x.code.trim().toLowerCase() === v.trim().toLowerCase());
    setLocal((p) => {
      const next = { ...p, codigoEquipo: v };
      if (e) {
        if (!p.nombreEquipo || p.nombreEquipo.trim().toLowerCase() !== e.name.trim().toLowerCase()) {
          next.nombreEquipo = e.name.trim();
        }
      }
      return next;
    });
  };
  const onNombreEquipo = (v: string) => {
    setLocal((p) => {
      const next = { ...p, nombreEquipo: v };
      // if current code's name doesn't match selected name, clear code
      if (p.codigoEquipo) {
        const e = equipment.find((x) => x.code.trim().toLowerCase() === p.codigoEquipo.trim().toLowerCase());
        if (e && e.name.trim().toLowerCase() !== v.trim().toLowerCase()) next.codigoEquipo = "";
      }
      return next;
    });
  };

  const aplicar = () => {
    setFiltros(local);
    const sp = filtersToParams(local);
    const qs = sp.toString();
    navigate(qs ? `/resultados?${qs}` : "/resultados");
  };
  const limpiar = () => {
    setLocal(filtrosVacios);
    resetFiltros();
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" />Volver al listado</Button>
          <h2 className="text-xl font-semibold">Filtros avanzados</h2>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Coincidencias previas: <strong className="text-foreground">{preview}</strong></span>
          <Button variant="outline" onClick={limpiar} className="gap-2"><RotateCcw className="h-4 w-4" />Limpiar</Button>
          <Button onClick={aplicar} className="gap-2"><FilterIcon className="h-4 w-4" />Aplicar filtros</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Fechas">
          <F label="Periodo de creación">
            <RangoFechas desde={local.fechaCreacionDesde} hasta={local.fechaCreacionHasta}
              onDesde={(v: string) => set("fechaCreacionDesde", v)} onHasta={(v: string) => set("fechaCreacionHasta", v)} />
          </F>
          <F label="Fecha de inicio">
            <RangoFechas desde={local.fechaInicioDesde} hasta={local.fechaInicioHasta}
              onDesde={(v: string) => set("fechaInicioDesde", v)} onHasta={(v: string) => set("fechaInicioHasta", v)} />
          </F>
          <F label="Fecha de finalización">
            <RangoFechas desde={local.fechaFinDesde} hasta={local.fechaFinHasta}
              onDesde={(v: string) => set("fechaFinDesde", v)} onHasta={(v: string) => set("fechaFinHasta", v)} />
          </F>
          <F label="Fecha límite realización">
            <RangoFechas desde={local.fechaLimiteDesde} hasta={local.fechaLimiteHasta}
              onDesde={(v: string) => set("fechaLimiteDesde", v)} onHasta={(v: string) => set("fechaLimiteHasta", v)} />
          </F>
        </Section>

        <Section title="Datos generales">
          <F label="Nro. de orden">
            <SearchSelect value={local.nroOrden} onChange={(v) => set("nroOrden", v)} options={optNroOrden} placeholder="Buscar número de orden..." />
          </F>
          <F label="Sector">
            <SearchSelect value={local.sector} onChange={(v) => set("sector", v)} options={optSector} placeholder="Seleccionar sector..." />
          </F>
          <F label="Técnico responsable">
            <SearchSelect value={local.tecnicoResponsable} onChange={(v) => set("tecnicoResponsable", v)} options={optTecnico} placeholder="Seleccionar técnico..." />
          </F>
          <F label="Solicitante">
            <SearchSelect value={local.solicitante} onChange={(v) => set("solicitante", v)} options={optSolicitante} placeholder="Seleccionar solicitante..." />
          </F>
          <div className="lg:col-span-2"><F label="Tipo de orden">
            <MultiCheck<string> opciones={optTiposOrden}
              valores={local.tipoOrden} onChange={(v) => set("tipoOrden", v)} />
          </F></div>
          <div className="lg:col-span-2"><F label="Estado">
            <MultiCheck<EstadoOrden> opciones={["Cumplido","Pendiente","En proceso"]}
              valores={local.estado} onChange={(v) => set("estado", v)} />
          </F></div>
          <div className="lg:col-span-2"><F label="Prioridad">
            <MultiCheck<Prioridad> opciones={["Alta","Media","Baja"]}
              valores={local.prioridad} onChange={(v) => set("prioridad", v)} />
          </F></div>
          <F label="Aprobado / desaprobado">
            <Select value={local.aprobado} onValueChange={(v) => set("aprobado", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Todos","Aprobadas","No aprobadas"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
        </Section>

        <Section title="Equipo y horas">
          <F label="Código documento"><Input value={local.codigoDocumento} onChange={(e) => set("codigoDocumento", e.target.value)} /></F>
          <F label="Código equipo">
            <SearchSelect value={local.codigoEquipo} onChange={onCodigoEquipo} options={equipOpts.codeOptions} placeholder="Buscar código de equipo..." />
          </F>
          <F label="Nombre equipo">
            <SearchSelect value={local.nombreEquipo} onChange={onNombreEquipo} options={equipOpts.nameOptions} placeholder="Buscar nombre de equipo..." />
          </F>
          <F label="Recepción equipo">
            <Select value={local.estadoRecepcionEquipo} onValueChange={(v) => set("estadoRecepcionEquipo", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Todos","APTO","NO APTO"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Horas presupuestadas">
            <RangoNum min={local.horasPresupMin} max={local.horasPresupMax}
              onMin={(v: string) => set("horasPresupMin", v)} onMax={(v: string) => set("horasPresupMax", v)} />
          </F>
          <F label="Horas reales">
            <RangoNum min={local.horasRealesMin} max={local.horasRealesMax}
              onMin={(v: string) => set("horasRealesMin", v)} onMax={(v: string) => set("horasRealesMax", v)} />
          </F>
          <F label="Proyectos / equipo asociado">
            <Select value={local.projectEquipo} onValueChange={(v) => set("projectEquipo", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="ConEquipo">Proyectos con equipo</SelectItem>
                <SelectItem value="SinEquipo">Proyectos sin equipo</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </Section>

        <Section title="Impacto productivo">
          <F label="¿Se paró la línea?">
            <Select value={local.lineStopped} onValueChange={(v) => set("lineStopped", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Todos","Si","No"].map((x) => <SelectItem key={x} value={x}>{x === "Si" ? "Sí" : x}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Horas de línea parada">
            <RangoNum min={local.lineStoppedHorasMin} max={local.lineStoppedHorasMax}
              onMin={(v: string) => set("lineStoppedHorasMin", v)} onMax={(v: string) => set("lineStoppedHorasMax", v)} />
          </F>
          <F label="Archivos adjuntos">
            <Select value={local.attachments} onValueChange={(v) => set("attachments", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Con">Con archivos adjuntos</SelectItem>
                <SelectItem value="Sin">Sin archivos adjuntos</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </Section>

        <Section title="Calidad y aprobaciones">
          <F label="Sector limpio">
            <Select value={local.sectorLimpio} onValueChange={(v) => set("sectorLimpio", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Todos","Limpio","No limpio"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Herramientas ordenadas">
            <Select value={local.herramientasLimpias} onValueChange={(v) => set("herramientasLimpias", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Todos","Ordenado","No ordenado"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Control de calidad">
            <Select value={local.controlCalidad} onValueChange={(v) => set("controlCalidad", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Todos","SI","NO"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Responsable Calidad">
            <SearchSelect value={local.responsableControlCalidad} onChange={(v) => set("responsableControlCalidad", v)} options={optCalidad} placeholder="Seleccionar responsable..." />
          </F>
          <F label="Elaboró">
            <SearchSelect value={local.elaboro} onChange={(v) => set("elaboro", v)} options={optElaboro} placeholder="Seleccionar quién elaboró..." />
          </F>
          <F label="Revisó">
            <SearchSelect value={local.reviso} onChange={(v) => set("reviso", v)} options={optReviso} placeholder="Seleccionar quién revisó..." />
          </F>
          <F label="Aprobó">
            <SearchSelect value={local.aprobo} onChange={(v) => set("aprobo", v)} options={optAprobo} placeholder="Seleccionar quién aprobó..." />
          </F>
        </Section>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate("/")}>Volver al listado</Button>
          <Button variant="outline" onClick={limpiar} className="gap-2"><RotateCcw className="h-4 w-4" />Limpiar filtros</Button>
          <Button onClick={aplicar} className="gap-2"><FilterIcon className="h-4 w-4" />Aplicar filtros</Button>
        </div>
      </div>
    </AppLayout>
  );
}
