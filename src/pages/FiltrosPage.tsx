import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { Filtros, filtrosVacios, EstadoOrden, Prioridad, TipoOrden } from "@/types/orden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aplicarFiltros } from "@/lib/filterOrdenes";
import { ArrowLeft, Filter as FilterIcon, RotateCcw } from "lucide-react";

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

export default function FiltrosPage() {
  const navigate = useNavigate();
  const { ordenes, filtros, setFiltros, resetFiltros, loaded, loadAll } = useOrdenesStore();
  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);
  const [local, setLocal] = useState<Filtros>(filtros);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setLocal((p) => ({ ...p, [k]: v }));
  const preview = useMemo(() => aplicarFiltros(ordenes, local).length, [ordenes, local]);

  const aplicar = () => { setFiltros(local); navigate("/resultados"); };
  const limpiar = () => { setLocal(filtrosVacios); resetFiltros(); };

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
          <F label="Nro. de orden"><Input value={local.nroOrden} onChange={(e) => set("nroOrden", e.target.value)} /></F>
          <F label="Sector"><Input value={local.sector} onChange={(e) => set("sector", e.target.value)} /></F>
          <F label="Técnico responsable"><Input value={local.tecnicoResponsable} onChange={(e) => set("tecnicoResponsable", e.target.value)} /></F>
          <F label="Solicitante"><Input value={local.solicitante} onChange={(e) => set("solicitante", e.target.value)} /></F>
          <div className="lg:col-span-2"><F label="Tipo de orden">
            <MultiCheck<TipoOrden> opciones={["Preventivo","Correctivo","Edilicio","Limpieza"]}
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
          <F label="Código equipo"><Input value={local.codigoEquipo} onChange={(e) => set("codigoEquipo", e.target.value)} /></F>
          <F label="Nombre equipo"><Input value={local.nombreEquipo} onChange={(e) => set("nombreEquipo", e.target.value)} /></F>
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
          <F label="Responsable Calidad"><Input value={local.responsableControlCalidad} onChange={(e) => set("responsableControlCalidad", e.target.value)} /></F>
          <F label="Elaboró"><Input value={local.elaboro} onChange={(e) => set("elaboro", e.target.value)} /></F>
          <F label="Revisó"><Input value={local.reviso} onChange={(e) => set("reviso", e.target.value)} /></F>
          <F label="Aprobó"><Input value={local.aprobo} onChange={(e) => set("aprobo", e.target.value)} /></F>
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
