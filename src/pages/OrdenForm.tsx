import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { Plus, Trash2, Save, ArrowLeft, Printer, Lock } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { canEditSection, canEditAny, canCreateOrden, SeccionNro } from "@/lib/permissions";
import { Combobox, ComboboxOption } from "@/components/Combobox";
import { listSectors, listPeople, listEquipment, listOrderTypes, listDocumentCodes, Sector, Person, Equipment, OrderType, DocumentCode } from "@/lib/catalogos/api";
import { PrintableOrden } from "@/components/PrintableOrden";
import { MultiPersonSelect } from "@/components/MultiPersonSelect";
import { OrdenAttachments } from "@/components/OrdenAttachments";
import { Attachment } from "@/lib/attachments/api";
import { useOrdenesStore as useStoreForCounts } from "@/store/ordenesStore";

const handlePrint = (orden: Orden) => {
  const filename = orden.nroOrden ? `INCALFOOD OIT ${orden.nroOrden}` : "INCALFOOD OIT SIN NUMERO";
  const prevTitle = document.title;
  const setTitle = () => { document.title = filename; };
  const restore = () => {
    document.title = prevTitle;
    window.removeEventListener("afterprint", restore);
    window.removeEventListener("beforeprint", setTitle);
  };
  window.addEventListener("beforeprint", setTitle);
  window.addEventListener("afterprint", restore);
  setTitle();
  setTimeout(() => {
    window.print();
    // fallback restore por si afterprint no dispara
    setTimeout(restore, 1500);
  }, 80);
};

const uid = () => Math.random().toString(36).slice(2, 10);

const empty = (nro: number): Orden => ({
  id: uid(), nroOrden: nro, fechaCreacion: new Date().toISOString().slice(0, 10),
  fechaInicio: "", fechaFinalizacion: "", fechaLimiteRealizacion: "",
  tecnicoResponsable: "", tecnicosResponsables: [], sector: "", tipoOrden: "", aprobado: false,
  estado: "Pendiente", prioridad: "Media", horasPresupuestadas: "", horasReales: "",
  descripcionProblema: "", codigoDocumento: "", codigoEquipo: "", nombreEquipo: "",
  solicitante: "", trabajoSolicitado: "", estadoRecepcionEquipo: "",
  observaciones: "", sectorLimpioOrdenado: false, herramientasLimpiasOrdenadas: false,
  materialesUtilizados: [], controlLiberacionCalidad: false,
  responsableControlCalidad: "", comentarioCalidad: "", elaboro: "", reviso: "", aprobo: "",
  lineStopped: null, lineStoppedHours: "",
  projectHasEquipment: null,
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});


function Section({
  title, seccion, canEdit, children,
}: { title: string; seccion: SeccionNro; canEdit: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">{title}</h2>
        {!canEdit && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Solo lectura</span>
        )}
      </div>
      <fieldset
        disabled={!canEdit}
        aria-disabled={!canEdit}
        className={`p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!canEdit ? "opacity-75" : ""}`}
      >
        {children}
      </fieldset>
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
  const [searchParams] = useSearchParams();
  const { ordenes, loaded, loadAll, addOrden, updateOrden, nextNroOrden, nombreDe } = useOrdenesStore();
  const { roles } = useAuth();
  const isEdit = id && id !== "nueva";
  const relevamientoId = !isEdit ? searchParams.get("relevamiento_id") : null;
  const [orden, setOrden] = useState<Orden | null>(null);
  const [saving, setSaving] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [equipos, setEquipos] = useState<Equipment[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [documentCodes, setDocumentCodes] = useState<DocumentCode[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const refreshAttachmentCounts = useStoreForCounts((s) => s.refreshAttachmentCounts);

  useEffect(() => {
    Promise.all([listSectors(), listPeople(), listEquipment(), listOrderTypes(), listDocumentCodes()])
      .then(([s, p, e, t, d]) => { setSectors(s); setPeople(p); setEquipos(e); setOrderTypes(t); setDocumentCodes(d); })
      .catch(() => { /* silencioso, los campos seguirán mostrando snapshot */ });
  }, []);

  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);

  useEffect(() => {
    if (isEdit) {
      const found = ordenes.find((o) => o.id === id);
      if (found) setOrden({ ...found });
    } else if (loaded && !orden) {
      const base = empty(nextNroOrden());
      // Prefill desde relevamiento (query params)
      if (relevamientoId) {
        const solicitante = searchParams.get("solicitante") || "";
        const descripcion = searchParams.get("descripcion") || "";
        const prioridad = searchParams.get("prioridad") || "";
        const involEquipo = searchParams.get("involucrado_equipo") || "";
        const sectorPre = searchParams.get("sector") || "";
        const sinEquipo = searchParams.get("sin_equipo") === "1";
        base.solicitante = solicitante;
        base.descripcionProblema = descripcion;
        base.trabajoSolicitado = descripcion;
        base.tipoOrden = "Correctivo" as Orden["tipoOrden"];
        if (prioridad === "Alta" || prioridad === "Media" || prioridad === "Baja") {
          base.prioridad = prioridad as Orden["prioridad"];
        }
        if (sinEquipo) {
          base.projectHasEquipment = false;
          base.sector = sectorPre;
        } else if (involEquipo) {
          base.projectHasEquipment = true;
          base.nombreEquipo = involEquipo;
        }
      }
      setOrden(base);
    }
  }, [id, loaded, ordenes]); // eslint-disable-line

  if (!orden) {
    return <AppLayout><div className="text-center py-10 text-muted-foreground">Cargando...</div></AppLayout>;
  }

  // Permission flags
  const can1 = canEditSection(roles, 1);
  const can2 = canEditSection(roles, 2);
  const can3 = canEditSection(roles, 3);
  const can4 = canEditSection(roles, 4);
  const can5 = canEditSection(roles, 5);
  const can6 = canEditSection(roles, 6);
  const puedeGuardar = isEdit ? canEditAny(roles) : canCreateOrden(roles);

  if (!isEdit && !canCreateOrden(roles)) {
    return <AppLayout><div className="text-center py-10 text-muted-foreground">No tenés permisos para crear órdenes.</div></AppLayout>;
  }

  const set = <K extends keyof Orden>(k: K, v: Orden[K]) => setOrden((o) => o ? ({ ...o, [k]: v }) : o);

  const addMat = () => set("materialesUtilizados", [...orden.materialesUtilizados, { id: uid(), cantidad: "", descripcion: "", codigo: "" }]);
  const updMat = (i: number, patch: Partial<Material>) =>
    set("materialesUtilizados", orden.materialesUtilizados.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const delMat = (i: number) => set("materialesUtilizados", orden.materialesUtilizados.filter((_, idx) => idx !== i));

  // Lookup selected order type metadata (falls back to legacy name match for historical OITs)
  const selectedType = orden.tipoOrden
    ? orderTypes.find((t) => t.name.trim().toLowerCase() === String(orden.tipoOrden).trim().toLowerCase())
    : undefined;
  const requiresLineStoppage =
    selectedType?.requires_line_stoppage_question ?? (orden.tipoOrden === "Correctivo");

  const validar = (): string | null => {
    if (!orden.nroOrden) return "Nro. de orden obligatorio";
    if (!orden.fechaCreacion) return "Fecha de creación obligatoria";
    if (!orden.sector.trim()) return "Sector obligatorio";
    if (!orden.tipoOrden) return "Tipo obligatorio";
    if (!orden.estado) return "Estado obligatorio";
    if (!orden.prioridad) return "Prioridad obligatoria";
    if (Number(orden.horasPresupuestadas) < 0 || Number(orden.horasReales) < 0) return "Las horas no pueden ser negativas";
    if (requiresLineStoppage) {
      if (orden.lineStopped === null) return "Indicar si se paró la línea.";
      if (orden.lineStopped === true) {
        if (orden.lineStoppedHours === "" || orden.lineStoppedHours === null) return "Cargar las horas de línea parada.";
        if (Number(orden.lineStoppedHours) <= 0) return "Las horas de línea parada deben ser mayores a 0.";
      }
    }
    if (orden.projectHasEquipment === null || orden.projectHasEquipment === undefined) {
      return "Indicá si la OIT está asociada a un equipo.";
    }
    if (orden.projectHasEquipment === true && !orden.codigoEquipo?.trim() && !orden.nombreEquipo?.trim()) {
      return "Seleccioná el equipo asociado a la OIT.";
    }
    return null;
  };

  const setTipoOrden = (v: string) => {
    const next = orderTypes.find((t) => t.name.trim().toLowerCase() === v.trim().toLowerCase());
    const needs = next?.requires_line_stoppage_question ?? (v === "Correctivo");
    setOrden((o) => {
      if (!o) return o;
      let n: Orden = { ...o, tipoOrden: v };
      if (!needs) { n.lineStopped = null; n.lineStoppedHours = ""; }
      if ((o.projectHasEquipment === null || o.projectHasEquipment === undefined) &&
          (o.codigoEquipo?.trim() || o.nombreEquipo?.trim())) {
        n.projectHasEquipment = true;
      }
      return n;
    });
  };

  const guardar = async (volver: boolean) => {
    const err = validar();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateOrden(orden.id, orden);
        toast.success("Orden actualizada");
      } else {
        await addOrden(orden);
        toast.success("Orden creada");
      }
      if (volver) navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
          <h2 className="text-xl font-semibold">{isEdit ? `Editar Orden #${orden.nroOrden}` : "Nueva Orden"}</h2>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => handlePrint(orden)} className="gap-2"><Printer className="h-4 w-4" />Imprimir / PDF</Button>
          <Button variant="outline" onClick={() => navigate("/")}>Cancelar</Button>
          {puedeGuardar && (
            <>
              <Button variant="secondary" disabled={saving} onClick={() => guardar(false)} className="gap-2"><Save className="h-4 w-4" />Guardar</Button>
              <Button disabled={saving} onClick={() => guardar(true)} className="gap-2"><Save className="h-4 w-4" />Guardar y volver</Button>
            </>
          )}
        </div>
      </div>

      {isEdit && (
        <div className="mb-4 text-xs text-muted-foreground bg-muted/40 border border-border rounded px-3 py-2 flex flex-wrap gap-x-6 gap-y-1 avoid-break">
          <span><b>Creado por:</b> {nombreDe(orden.createdBy)} — {orden.createdAt?.replace("T", " ").slice(0, 16)}</span>
          <span><b>Última modificación:</b> {nombreDe(orden.updatedBy)} — {orden.updatedAt?.replace("T", " ").slice(0, 16)}</span>
        </div>
      )}

      <PrintableOrden orden={orden} attachments={attachments} />


      <div className="space-y-4">
        <Section title="1. Datos principales" seccion={1} canEdit={can1}>
          <Field label="Nro. de orden" required>
            <Input type="number" value={orden.nroOrden} onChange={(e) => set("nroOrden", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Fecha de creación" required>
            <Input type="date" value={orden.fechaCreacion} onChange={(e) => set("fechaCreacion", e.target.value)} />
          </Field>
          <Field label="Solicitante">
            <Combobox
              options={people.filter((p) => p.active && p.can_be_requester).map<ComboboxOption>((p) => ({ value: p.full_name, label: p.full_name }))}
              value={orden.solicitante} onChange={(v) => set("solicitante", v)} disabled={!can1}
              allowFreeSnapshot placeholder="Seleccionar persona..." />
          </Field>
          <Field label="Técnicos responsables">
            <MultiPersonSelect
              options={people.filter((p) => p.active && p.can_be_technician).map((p) => ({ value: p.full_name, label: p.full_name }))}
              values={
                (orden.tecnicosResponsables && orden.tecnicosResponsables.length > 0)
                  ? orden.tecnicosResponsables
                  : (orden.tecnicoResponsable ? orden.tecnicoResponsable.split(",").map((x) => x.trim()).filter(Boolean) : [])
              }
              onChange={(v) => {
                setOrden((o) => o ? ({ ...o, tecnicosResponsables: v, tecnicoResponsable: v.join(", ") }) : o);
              }}
              disabled={!can1}
              allowFreeText
              placeholder="Agregar técnico..."
            />
          </Field>
          <Field label="Sector" required>
            <Combobox
              options={sectors.filter((s) => s.active).map<ComboboxOption>((s) => ({ value: s.name, label: s.name }))}
              value={orden.sector} onChange={(v) => set("sector", v)} disabled={!can1}
              allowFreeSnapshot placeholder="Seleccionar sector..." />
          </Field>
          <Field label="Tipo de orden" required>
            <Select value={orden.tipoOrden || undefined} onValueChange={setTipoOrden} disabled={!can1}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {(() => {
                  const activos = orderTypes.filter((t) => t.active);
                  const currentVal = String(orden.tipoOrden ?? "").trim();
                  const hasCurrent = !!currentVal && activos.some((t) => t.name.trim().toLowerCase() === currentVal.toLowerCase());
                  const items = [...activos.map((t) => ({ key: t.id, value: t.name, label: t.name }))];
                  if (currentVal && !hasCurrent) {
                    items.push({ key: `legacy-${currentVal}`, value: currentVal, label: `${currentVal} (inactivo)` });
                  }
                  return items.map((x) => <SelectItem key={x.key} value={x.value}>{x.label}</SelectItem>);
                })()}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado" required>
            <Select value={orden.estado || undefined} onValueChange={(v) => set("estado", v as any)} disabled={!can1}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {["Cumplido", "Pendiente", "En proceso"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridad" required>
            <Select value={orden.prioridad || undefined} onValueChange={(v) => set("prioridad", v as any)} disabled={!can1}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {["Alta", "Media", "Baja"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aprobado">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={orden.aprobado} onCheckedChange={(v) => set("aprobado", v)} disabled={!can1} />
              <span className="text-sm text-muted-foreground">{orden.aprobado ? "Aprobado" : "No aprobado"}</span>
            </div>
          </Field>
        </Section>

        <Section title="2. Planificación y ejecución" seccion={2} canEdit={can2}>
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
          {requiresLineStoppage && (
            <>
              <Field label="¿Se paró la línea?" required>
                <div className="flex gap-4 h-10 items-center">
                  {([["Sí", true], ["No", false]] as const).map(([lbl, val]) => (
                    <label key={lbl} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="line_stopped"
                        checked={orden.lineStopped === val}
                        onChange={() => setOrden((o) => o ? ({
                          ...o,
                          lineStopped: val,
                          lineStoppedHours: val ? o.lineStoppedHours : "",
                        }) : o)}
                        disabled={!can2}
                      />
                      {lbl}
                    </label>
                  ))}
                </div>
              </Field>
              {orden.lineStopped === true && (
                <Field label="Horas de línea parada" required>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={orden.lineStoppedHours}
                    onChange={(e) => {
                      const raw = e.target.value.replace(",", ".");
                      if (raw === "") { set("lineStoppedHours", ""); return; }
                      if (!/^\d*\.?\d*$/.test(raw)) return;
                      const n = Number(raw);
                      set("lineStoppedHours", isNaN(n) ? "" : n);
                    }}
                  />
                </Field>
              )}
            </>
          )}
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

        <Section title="3. Equipo y documentación" seccion={3} canEdit={can3}>
          <Field label="Código de documento">
            <Combobox
              options={(() => {
                const seen = new Set<string>();
                const opts: ComboboxOption[] = [];
                documentCodes
                  .slice()
                  .sort((a, b) => Number(b.active) - Number(a.active) || a.sort_order - b.sort_order || a.code.localeCompare(b.code))
                  .forEach((d) => {
                    const k = d.code.trim();
                    if (!k || seen.has(k.toLowerCase())) return;
                    seen.add(k.toLowerCase());
                    opts.push({ value: k, label: d.active ? (d.description ? `${k} — ${d.description}` : k) : `${k} (inactivo)`, keywords: d.description ?? "" });
                  });
                const cur = orden.codigoDocumento?.trim();
                if (cur && !seen.has(cur.toLowerCase())) opts.push({ value: cur, label: `${cur} (histórico)` });
                return opts;
              })()}
              value={orden.codigoDocumento}
              onChange={(v) => set("codigoDocumento", v)}
              placeholder="Seleccionar código..."
              allowFreeSnapshot
              disabled={!can3}
            />
          </Field>

          <div className="md:col-span-2 lg:col-span-3">
            <Field label="¿Esta OIT está asociada a un equipo?" required>
              <div className="flex gap-4 h-10 items-center">
                {([["Sí", true], ["No", false]] as const).map(([lbl, val]) => (
                  <label key={lbl} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="project_has_equipment"
                      checked={orden.projectHasEquipment === val}
                      onChange={() => setOrden((o) => o ? ({
                        ...o,
                        projectHasEquipment: val,
                        codigoEquipo: val ? o.codigoEquipo : "",
                        nombreEquipo: val ? o.nombreEquipo : "",
                      }) : o)}
                      disabled={!can3}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
              {orden.projectHasEquipment === false && (
                <p className="text-xs text-muted-foreground mt-1">
                  Esta OIT se registrará sin equipo asociado.
                </p>
              )}
            </Field>
          </div>

          {orden.projectHasEquipment === true && (
            <>
              <Field label="Código de equipo" required>
                <Combobox
                  options={equipos.filter((e) => e.active).map<ComboboxOption>((e) => ({ value: e.code, label: `${e.code} — ${e.name}`, keywords: e.name }))}
                  value={orden.codigoEquipo}
                  onChange={(v) => {
                    const eq = equipos.find((x) => x.code === v);
                    setOrden((o) => o ? ({ ...o, codigoEquipo: v, nombreEquipo: eq ? eq.name : o.nombreEquipo }) : o);
                  }}
                  disabled={!can3} allowFreeSnapshot placeholder="Seleccionar código..." />
              </Field>
              <Field label="Nombre de equipo" required>
                <Combobox
                  options={Array.from(new Set(equipos.filter((e) => e.active).map((e) => e.name))).sort().map<ComboboxOption>((n) => ({ value: n, label: n }))}
                  value={orden.nombreEquipo}
                  onChange={(v) => {
                    const matches = equipos.filter((e) => e.active && e.name === v);
                    setOrden((o) => {
                      if (!o) return o;
                      if (matches.length === 1) return { ...o, nombreEquipo: v, codigoEquipo: matches[0].code };
                      const keepCode = matches.some((m) => m.code === o.codigoEquipo);
                      return { ...o, nombreEquipo: v, codigoEquipo: keepCode ? o.codigoEquipo : "" };
                    });
                  }}
                  disabled={!can3} allowFreeSnapshot placeholder="Seleccionar equipo..." />
                {orden.nombreEquipo && equipos.filter((e) => e.active && e.name === orden.nombreEquipo).length > 1 && !orden.codigoEquipo && (
                  <p className="text-xs text-amber-600 mt-1">Hay varios códigos para este nombre. Elegí el código arriba.</p>
                )}
              </Field>
            </>
          )}
        </Section>

        <Section title="4. Recepción, limpieza y herramientas" seccion={4} canEdit={can4}>
          <Field label="Estado de recepción del equipo">
            <div className="flex gap-4 h-10 items-center">
              {(["APTO", "NO APTO"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="recep" checked={orden.estadoRecepcionEquipo === opt}
                    onChange={() => set("estadoRecepcionEquipo", opt)} disabled={!can4} />
                  {opt}
                </label>
              ))}
              <button type="button" className="text-xs text-muted-foreground underline" disabled={!can4}
                onClick={() => set("estadoRecepcionEquipo", "")}>limpiar</button>
            </div>
          </Field>
          <Field label="Sector limpio y ordenado">
            <div className="flex items-center gap-2 h-10">
              <Checkbox checked={orden.sectorLimpioOrdenado} onCheckedChange={(v) => set("sectorLimpioOrdenado", !!v)} disabled={!can4} />
              <span className="text-sm">Sí, dejado limpio y ordenado</span>
            </div>
          </Field>
          <Field label="Herramientas limpias y ordenadas">
            <div className="flex items-center gap-2 h-10">
              <Checkbox checked={orden.herramientasLimpiasOrdenadas} onCheckedChange={(v) => set("herramientasLimpiasOrdenadas", !!v)} disabled={!can4} />
              <span className="text-sm">Sí, dejadas limpias y ordenadas</span>
            </div>
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Observaciones"><Textarea rows={3} value={orden.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></Field>
          </div>
        </Section>

        {(orden.materialesPrevistos && orden.materialesPrevistos.length > 0) && (
          <div className="bg-card border border-border rounded-md shadow-sm">
            <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">Materiales previstos (desde preventivo)</h2>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Solo lectura</span>
            </div>
            <div className="overflow-x-auto opacity-90">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th className="w-32">Código</th>
                    <th>Descripción</th>
                    <th className="w-24">Cantidad</th>
                    <th className="w-24">Unidad</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orden.materialesPrevistos.map((m) => (
                    <tr key={m.id}>
                      <td>{m.codigo || "-"}</td>
                      <td>{m.descripcion || "-"}</td>
                      <td>{m.cantidad === "" || m.cantidad == null ? "-" : m.cantidad}</td>
                      <td>{m.unidad || "-"}</td>
                      <td>{m.observaciones || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-md shadow-sm">

          <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">5. Materiales utilizados</h2>
            <div className="flex items-center gap-2">
              {!can5 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Solo lectura</span>}
              {can5 && <Button size="sm" variant="outline" onClick={addMat} className="gap-1"><Plus className="h-3 w-3" /> Agregar material</Button>}
            </div>
          </div>
          <fieldset disabled={!can5} className={`overflow-x-auto ${!can5 ? "opacity-75" : ""}`}>
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
                    <td><Button size="icon" variant="ghost" onClick={() => delMat(i)} disabled={!can5}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </fieldset>
        </div>

        <Section title="6. Calidad y aprobaciones" seccion={6} canEdit={can6}>
          <Field label="Control / Liberación de Calidad">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={orden.controlLiberacionCalidad} onCheckedChange={(v) => set("controlLiberacionCalidad", v)} disabled={!can6} />
              <span className="text-sm">{orden.controlLiberacionCalidad ? "SI" : "NO"}</span>
            </div>
          </Field>
          <Field label="Responsable Control de Calidad">
            <Combobox
              options={people.filter((p) => p.active && p.can_be_quality_responsible).map<ComboboxOption>((p) => ({ value: p.full_name, label: p.full_name }))}
              value={orden.responsableControlCalidad} onChange={(v) => set("responsableControlCalidad", v)} disabled={!can6}
              allowFreeSnapshot placeholder="Seleccionar persona..." />
          </Field>
          <div className="hidden lg:block" />
          <Field label="Elaboró">
            <Combobox
              options={people.filter((p) => p.active && p.can_be_created_by).map<ComboboxOption>((p) => ({ value: p.full_name, label: p.full_name }))}
              value={orden.elaboro} onChange={(v) => set("elaboro", v)} disabled={!can6}
              allowFreeSnapshot placeholder="Seleccionar persona..." />
          </Field>
          <Field label="Revisó">
            <Combobox
              options={people.filter((p) => p.active && p.can_be_reviewed_by).map<ComboboxOption>((p) => ({ value: p.full_name, label: p.full_name }))}
              value={orden.reviso} onChange={(v) => set("reviso", v)} disabled={!can6}
              allowFreeSnapshot placeholder="Seleccionar persona..." />
          </Field>
          <Field label="Aprobó">
            <Combobox
              options={people.filter((p) => p.active && p.can_be_approver).map<ComboboxOption>((p) => ({ value: p.full_name, label: p.full_name }))}
              value={orden.aprobo} onChange={(v) => set("aprobo", v)} disabled={!can6}
              allowFreeSnapshot placeholder="Seleccionar persona..." />
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Comentario">
              <Textarea
                rows={3}
                value={orden.comentarioCalidad ?? ""}
                onChange={(e) => set("comentarioCalidad", e.target.value)}
                placeholder="Comentarios de calidad / aprobación..."
              />
            </Field>
          </div>
        </Section>

        <div className="bg-card border border-border rounded-md shadow-sm no-print">
          <div className="bg-secondary px-4 py-2 border-b border-border rounded-t-md">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-secondary-foreground">
              7. Archivos adjuntos
            </h2>
          </div>
          <div className="p-4">
            <OrdenAttachments
              workOrderId={isEdit ? orden.id : null}
              canEdit={canEditAny(roles)}
              canDelete={canEditAny(roles)}
              onListChange={(items) => {
                setAttachments(items);
                if (isEdit) refreshAttachmentCounts();
              }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 no-print">
          <Button variant="outline" onClick={() => navigate("/")}>Cancelar</Button>
          {puedeGuardar && (
            <>
              <Button variant="secondary" disabled={saving} onClick={() => guardar(false)} className="gap-2"><Save className="h-4 w-4" />Guardar</Button>
              <Button disabled={saving} onClick={() => guardar(true)} className="gap-2"><Save className="h-4 w-4" />Guardar y volver al listado</Button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
