import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { Material, Orden } from "@/types/orden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const uid = () => Math.random().toString(36).slice(2, 10);

const empty = (nro: number): Orden => ({
  id: uid(), nroOrden: nro, fechaCreacion: new Date().toISOString().slice(0, 10),
  fechaInicio: "", fechaFinalizacion: "", fechaLimiteRealizacion: "",
  tecnicoResponsable: "", sector: "", tipoOrden: "", aprobado: false,
  estado: "Pendiente", prioridad: "Media", horasPresupuestadas: "", horasReales: "",
  descripcionProblema: "", codigoDocumento: "", codigoEquipo: "", nombreEquipo: "",
  solicitante: "", trabajoSolicitado: "", estadoRecepcionEquipo: "",
  observaciones: "", sectorLimpioOrdenado: false, herramientasLimpiasOrdenadas: false,
  materialesUtilizados: [], controlLiberacionCalidad: false,
  responsableControlCalidad: "", elaboro: "", reviso: "", aprobo: "",
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">{title}</h2>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

export default function OrdenForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ordenes, addOrden, updateOrden, nextNroOrden } = useOrdenesStore();
  const isEdit = id && id !== "nueva";
  const [orden, setOrden] = useState<Orden>(() => {
    if (isEdit) {
      const found = ordenes.find((o) => o.id === id);
      if (found) return { ...found };
    }
    return empty(nextNroOrden());
  });

  useEffect(() => {
    if (isEdit) {
      const found = ordenes.find((o) => o.id === id);
      if (found) setOrden({ ...found });
    }
  }, [id]);

  const set = <K extends keyof Orden>(k: K, v: Orden[K]) => setOrden((o) => ({ ...o, [k]: v }));

  const addMat = () => set("materialesUtilizados", [...orden.materialesUtilizados, { id: uid(), cantidad: "", descripcion: "", codigo: "" }]);
  const updMat = (i: number, patch: Partial<Material>) =>
    set("materialesUtilizados", orden.materialesUtilizados.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const delMat = (i: number) => set("materialesUtilizados", orden.materialesUtilizados.filter((_, idx) => idx !== i));

  const validar = (): string | null => {
    if (!orden.nroOrden) return "Nro. de orden obligatorio";
    if (!orden.fechaCreacion) return "Fecha de creación obligatoria";
    if (!orden.sector.trim()) return "Sector obligatorio";
    if (!orden.tipoOrden) return "Tipo obligatorio";
    if (!orden.estado) return "Estado obligatorio";
    if (!orden.prioridad) return "Prioridad obligatoria";
    if (Number(orden.horasPresupuestadas) < 0 || Number(orden.horasReales) < 0) return "Las horas no pueden ser negativas";
    return null;
  };

  const guardar = (volver: boolean) => {
    const err = validar();
    if (err) { toast.error(err); return; }
    if (isEdit) {
      updateOrden(orden.id, orden);
      toast.success("Orden actualizada");
    } else {
      addOrden({ ...orden, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10) });
      toast.success("Orden creada");
    }
    if (volver) navigate("/");
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
          <h2 className="text-xl font-semibold">{isEdit ? `Editar Orden #${orden.nroOrden}` : "Nueva Orden"}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>Cancelar</Button>
          <Button variant="secondary" onClick={() => guardar(false)} className="gap-2"><Save className="h-4 w-4" />Guardar</Button>
          <Button onClick={() => guardar(true)} className="gap-2"><Save className="h-4 w-4" />Guardar y volver</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Section title="1. Datos principales">
          <Field label="Nro. de orden" required>
            <Input type="number" value={orden.nroOrden} onChange={(e) => set("nroOrden", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Fecha de creación" required>
            <Input type="date" value={orden.fechaCreacion} onChange={(e) => set("fechaCreacion", e.target.value)} />
          </Field>
          <Field label="Solicitante"><Input value={orden.solicitante} onChange={(e) => set("solicitante", e.target.value)} /></Field>
          <Field label="Técnico responsable"><Input value={orden.tecnicoResponsable} onChange={(e) => set("tecnicoResponsable", e.target.value)} /></Field>
          <Field label="Sector" required><Input value={orden.sector} onChange={(e) => set("sector", e.target.value)} /></Field>
          <Field label="Tipo de orden" required>
            <Select value={orden.tipoOrden || undefined} onValueChange={(v) => set("tipoOrden", v as any)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {["Preventivo", "Correctivo", "Edilicio", "Limpieza"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado" required>
            <Select value={orden.estado || undefined} onValueChange={(v) => set("estado", v as any)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {["Cumplido", "Pendiente", "En proceso"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridad" required>
            <Select value={orden.prioridad || undefined} onValueChange={(v) => set("prioridad", v as any)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {["Alta", "Media", "Baja"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aprobado">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={orden.aprobado} onCheckedChange={(v) => set("aprobado", v)} />
              <span className="text-sm text-muted-foreground">{orden.aprobado ? "Aprobado" : "No aprobado"}</span>
            </div>
          </Field>
        </Section>

        <Section title="2. Planificación y ejecución">
          <Field label="Fecha de inicio"><Input type="date" value={orden.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} /></Field>
          <Field label="Fecha de finalización"><Input type="date" value={orden.fechaFinalizacion} onChange={(e) => set("fechaFinalizacion", e.target.value)} /></Field>
          <Field label="Fecha límite realización"><Input type="date" value={orden.fechaLimiteRealizacion} onChange={(e) => set("fechaLimiteRealizacion", e.target.value)} /></Field>
          <Field label="Horas presupuestadas">
            <Input type="number" min={0} value={orden.horasPresupuestadas}
              onChange={(e) => set("horasPresupuestadas", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Horas reales">
            <Input type="number" min={0} value={orden.horasReales}
              onChange={(e) => set("horasReales", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Descripción del problema">
              <Textarea rows={3} value={orden.descripcionProblema} onChange={(e) => set("descripcionProblema", e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Trabajo solicitado">
              <Textarea rows={3} value={orden.trabajoSolicitado} onChange={(e) => set("trabajoSolicitado", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="3. Equipo y documentación">
          <Field label="Código de documento"><Input value={orden.codigoDocumento} onChange={(e) => set("codigoDocumento", e.target.value)} /></Field>
          <Field label="Código de equipo"><Input value={orden.codigoEquipo} onChange={(e) => set("codigoEquipo", e.target.value)} /></Field>
          <Field label="Nombre de equipo"><Input value={orden.nombreEquipo} onChange={(e) => set("nombreEquipo", e.target.value)} /></Field>
        </Section>

        <Section title="4. Recepción, limpieza y herramientas">
          <Field label="Estado de recepción del equipo">
            <div className="flex gap-4 h-10 items-center">
              {(["APTO", "NO APTO"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="recep" checked={orden.estadoRecepcionEquipo === opt}
                    onChange={() => set("estadoRecepcionEquipo", opt)} />
                  {opt}
                </label>
              ))}
              <button type="button" className="text-xs text-muted-foreground underline"
                onClick={() => set("estadoRecepcionEquipo", "")}>limpiar</button>
            </div>
          </Field>
          <Field label="Sector limpio y ordenado">
            <div className="flex items-center gap-2 h-10">
              <Checkbox checked={orden.sectorLimpioOrdenado} onCheckedChange={(v) => set("sectorLimpioOrdenado", !!v)} />
              <span className="text-sm">Sí, dejado limpio y ordenado</span>
            </div>
          </Field>
          <Field label="Herramientas limpias y ordenadas">
            <div className="flex items-center gap-2 h-10">
              <Checkbox checked={orden.herramientasLimpiasOrdenadas} onCheckedChange={(v) => set("herramientasLimpiasOrdenadas", !!v)} />
              <span className="text-sm">Sí, dejadas limpias y ordenadas</span>
            </div>
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Observaciones"><Textarea rows={3} value={orden.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></Field>
          </div>
        </Section>

        <div className="bg-card border border-border rounded-md shadow-sm">
          <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">5. Materiales utilizados</h2>
            <Button size="sm" variant="outline" onClick={addMat} className="gap-1"><Plus className="h-3 w-3" /> Agregar material</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr><th className="w-32">Cantidad</th><th>Descripción</th><th className="w-48">Código</th><th className="w-20">Acción</th></tr>
              </thead>
              <tbody>
                {orden.materialesUtilizados.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Sin materiales cargados</td></tr>
                )}
                {orden.materialesUtilizados.map((m, i) => (
                  <tr key={m.id}>
                    <td><Input type="number" min={0} value={m.cantidad}
                      onChange={(e) => updMat(i, { cantidad: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                    <td><Input value={m.descripcion} onChange={(e) => updMat(i, { descripcion: e.target.value })} /></td>
                    <td><Input value={m.codigo} onChange={(e) => updMat(i, { codigo: e.target.value })} /></td>
                    <td><Button size="icon" variant="ghost" onClick={() => delMat(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Section title="6. Calidad y aprobaciones">
          <Field label="Control / Liberación de Calidad">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={orden.controlLiberacionCalidad} onCheckedChange={(v) => set("controlLiberacionCalidad", v)} />
              <span className="text-sm">{orden.controlLiberacionCalidad ? "SI" : "NO"}</span>
            </div>
          </Field>
          <Field label="Responsable Control de Calidad">
            <Input value={orden.responsableControlCalidad} onChange={(e) => set("responsableControlCalidad", e.target.value)} />
          </Field>
          <div className="hidden lg:block" />
          <Field label="Elaboró"><Input value={orden.elaboro} onChange={(e) => set("elaboro", e.target.value)} /></Field>
          <Field label="Revisó"><Input value={orden.reviso} onChange={(e) => set("reviso", e.target.value)} /></Field>
          <Field label="Aprobó"><Input value={orden.aprobo} onChange={(e) => set("aprobo", e.target.value)} /></Field>
        </Section>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate("/")}>Cancelar</Button>
          <Button variant="secondary" onClick={() => guardar(false)} className="gap-2"><Save className="h-4 w-4" />Guardar</Button>
          <Button onClick={() => guardar(true)} className="gap-2"><Save className="h-4 w-4" />Guardar y volver al listado</Button>
        </div>
      </div>
    </AppLayout>
  );
}
