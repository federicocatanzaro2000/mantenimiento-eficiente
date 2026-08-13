import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchSelect } from "@/components/SearchSelect";
import { Equipment, listEquipment } from "@/lib/catalogos/api";
import {
  PreventiveItem,
  PreventiveItemInput,
  PreventiveMaterial,
  PREVENTIVE_TYPES,
  PREVENTIVE_STATUSES,
  PreventiveType,
  PreventiveStatus,
  RepeatUnit,
  RepeatEndMode,
  RecurrenceInput,
  MATERIAL_UNITS,
} from "@/lib/preventiveManual/types";

import {
  createPreventiveWithRecurrence,
  updatePreventive,
  updateSeries,
  cancelar,
  cancelSeriesFuture,
} from "@/lib/preventiveManual/api";
import { describeRule } from "@/lib/preventiveManual/recurrence";
import { toast } from "@/hooks/use-toast";
import { Repeat, Plus, Trash2, Package } from "lucide-react";

const mkMat = (): PreventiveMaterial => ({
  id: Math.random().toString(36).slice(2, 10),
  codigo: "",
  descripcion: "",
  cantidad: "",
  unidad: "",
  lote: "",
  fechaVencimiento: "",
  observaciones: "",
});


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: PreventiveItem | null;
  prefill?: Partial<PreventiveItemInput> & { year?: number; month?: number };
  onSaved: () => void;
}

interface FormState {
  scheduled_date: string;
  equipment_code: string;
  equipment_name: string;
  equipment_id: string | null;
  task_name: string;
  preventive_type: PreventiveType;
  frequency_label: string;
  status: PreventiveStatus;
  estimated_hours: string;
  notes: string;
  repeat_enabled: boolean;
  repeat_every: string;
  repeat_unit: RepeatUnit;
  repeat_end_mode: RepeatEndMode;
  repeat_end_date: string;
  repeat_count: string;
}

const empty = (year?: number, month?: number): FormState => ({
  scheduled_date: year && month ? `${year}-${String(month).padStart(2, "0")}-15` : new Date().toISOString().slice(0, 10),
  equipment_code: "",
  equipment_name: "",
  equipment_id: null,
  task_name: "",
  preventive_type: "Mecánico",
  frequency_label: "",
  status: "Programado",
  estimated_hours: "",
  notes: "",
  repeat_enabled: false,
  repeat_every: "1",
  repeat_unit: "month",
  repeat_end_mode: "never",
  repeat_end_date: "",
  repeat_count: "",
});

export function PreventivoFormDialog({ open, onOpenChange, item, prefill, onSaved }: Props) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [form, setForm] = useState<FormState>(empty());
  const [materials, setMaterials] = useState<PreventiveMaterial[]>([]);
  const [saving, setSaving] = useState(false);


  // ¿La ocurrencia editada pertenece a una serie?
  const isOccurrenceOfSeries = !!item?.recurrence_parent_id;
  const isSeriesParent = !!item?.is_recurrence_parent;

  useEffect(() => {
    if (open) listEquipment(true).then(setEquipment).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        scheduled_date: item.scheduled_date,
        equipment_code: item.equipment_code_snapshot,
        equipment_name: item.equipment_name_snapshot,
        equipment_id: item.equipment_id,
        task_name: item.task_name,
        preventive_type: item.preventive_type,
        frequency_label: item.frequency_label ?? "",
        status: item.status,
        estimated_hours: item.estimated_hours ? String(item.estimated_hours) : "",
        notes: item.notes ?? "",
        repeat_enabled: !!item.repeat_enabled,
        repeat_every: item.repeat_every ? String(item.repeat_every) : "1",
        repeat_unit: (item.repeat_unit as RepeatUnit) ?? "month",
        repeat_end_mode: (item.repeat_end_mode as RepeatEndMode) ?? "never",
        repeat_end_date: item.repeat_end_date ?? "",
        repeat_count: item.repeat_count ? String(item.repeat_count) : "",
      });
      const raw = Array.isArray(item.materiales_previstos) ? item.materiales_previstos : [];
      setMaterials(raw.map((m: any) => ({
        id: m.id ?? Math.random().toString(36).slice(2, 10),
        codigo: m.codigo ?? "",
        descripcion: m.descripcion ?? "",
        cantidad: m.cantidad ?? "",
        unidad: m.unidad ?? "",
        lote: m.lote ?? "",
        fechaVencimiento: m.fechaVencimiento ?? "",
        observaciones: m.observaciones ?? "",
      })));

    } else {
      const base = empty(prefill?.year, prefill?.month);
      setForm({
        ...base,
        scheduled_date: prefill?.scheduled_date ?? base.scheduled_date,
        equipment_code: prefill?.equipment_code_snapshot ?? base.equipment_code,
        equipment_name: prefill?.equipment_name_snapshot ?? base.equipment_name,
        equipment_id: prefill?.equipment_id ?? null,
        task_name: prefill?.task_name ?? base.task_name,
        preventive_type: prefill?.preventive_type ?? base.preventive_type,
        frequency_label: prefill?.frequency_label ?? base.frequency_label,
      });
      setMaterials([]);
    }

  }, [open, item, prefill]);

  const opts = equipment.map((e) => ({ value: e.code, label: `${e.code} - ${e.name}` }));

  function onEquipmentChange(code: string) {
    const eq = equipment.find((e) => e.code === code);
    setForm((f) => ({ ...f, equipment_code: code, equipment_name: eq?.name ?? "", equipment_id: eq?.id ?? null }));
  }

  function validate(): string | null {
    if (!form.scheduled_date) return "Fecha programada obligatoria";
    if (!form.equipment_code) return "Código de equipo obligatorio";
    if (!form.equipment_name) return "Nombre de equipo obligatorio";
    if (!form.task_name.trim()) return "Tarea preventiva obligatoria";
    if (!form.preventive_type) return "Tipo obligatorio";
    if (form.repeat_enabled) {
      const every = Number(form.repeat_every);
      if (!Number.isInteger(every) || every < 1) return "Frecuencia debe ser un entero ≥ 1";
      if (form.repeat_end_mode === "until" && !form.repeat_end_date) return "Indique fecha de fin de la repetición";
      if (form.repeat_end_mode === "count") {
        const c = Number(form.repeat_count);
        if (!Number.isInteger(c) || c < 2) return "Cantidad de repeticiones debe ser ≥ 2";
      }
    }
    return null;
  }

  function getInput(): PreventiveItemInput {
    const cleanMats = materials
      .map((m) => ({
        id: m.id,
        codigo: (m.codigo ?? "").trim(),
        descripcion: (m.descripcion ?? "").trim(),
        cantidad: m.cantidad === "" || m.cantidad === null || m.cantidad === undefined ? "" : Number(m.cantidad),
        unidad: (m.unidad ?? "").trim(),
        lote: (m.lote ?? "").trim(),
        fechaVencimiento: m.fechaVencimiento ?? "",
        observaciones: (m.observaciones ?? "").trim(),
      }))
      .filter((m) => m.codigo || m.descripcion || (m.cantidad !== "" && !Number.isNaN(Number(m.cantidad))));
    return {
      scheduled_date: form.scheduled_date,
      equipment_id: form.equipment_id,
      equipment_code_snapshot: form.equipment_code,
      equipment_name_snapshot: form.equipment_name,
      task_name: form.task_name.trim(),
      preventive_type: form.preventive_type,
      frequency_label: form.frequency_label.trim() || null,
      status: form.status,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      notes: form.notes.trim() || null,
      source: "manual",
      materiales_previstos: cleanMats as PreventiveMaterial[],
    };
  }


  function getRecurrence(): RecurrenceInput {
    return {
      repeat_enabled: form.repeat_enabled,
      repeat_every: form.repeat_enabled ? Number(form.repeat_every) : null,
      repeat_unit: form.repeat_enabled ? form.repeat_unit : null,
      repeat_end_mode: form.repeat_enabled ? form.repeat_end_mode : null,
      repeat_end_date: form.repeat_enabled && form.repeat_end_mode === "until" ? form.repeat_end_date : null,
      repeat_count: form.repeat_enabled && form.repeat_end_mode === "count" ? Number(form.repeat_count) : null,
    };
  }

  async function save(mode: "single" | "series" | "new-and-another" = "single") {
    const err = validate();
    if (err) { toast({ title: "Error", description: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const input = getInput();
      const recurrence = getRecurrence();
      if (item) {
        if (mode === "series") {
          const parentId = item.recurrence_parent_id ?? item.id;
          await updateSeries(parentId, input, recurrence);
          toast({ title: "Serie actualizada" });
        } else {
          // Editar solo esta ocurrencia: nunca toca la regla de recurrencia.
          await updatePreventive(item.id, input);
          toast({ title: "Preventivo actualizado" });
        }
      } else {
        await createPreventiveWithRecurrence(input, recurrence);
        if (recurrence.repeat_enabled) {
          toast({ title: "Preventivo creado", description: "Se generaron las ocurrencias futuras." });
        } else {
          toast({ title: "Preventivo creado" });
        }
      }
      onSaved();
      if (mode === "new-and-another" && !item) {
        const y = form.scheduled_date.slice(0, 4);
        setForm((f) => ({ ...f, scheduled_date: `${y}-01-15`, task_name: "", notes: "", repeat_enabled: false }));
      } else {
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelOccurrence() {
    if (!item) return;
    if (!confirm("¿Cancelar esta ocurrencia? Las demás de la serie no se afectan.")) return;
    setSaving(true);
    try {
      await cancelar(item.id);
      toast({ title: "Ocurrencia cancelada" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleCancelFutureSeries() {
    if (!item) return;
    const parentId = item.recurrence_parent_id ?? item.id;
    if (!confirm("¿Cancelar todas las ocurrencias futuras pendientes de esta serie? Las realizadas se conservan.")) return;
    setSaving(true);
    try {
      await cancelSeriesFuture(parentId);
      toast({ title: "Ocurrencias futuras canceladas" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const ruleHint = form.repeat_enabled && Number(form.repeat_every) > 0
    ? describeRule({
        every: Number(form.repeat_every),
        unit: form.repeat_unit,
        endMode: form.repeat_end_mode,
        endDate: form.repeat_end_date || null,
        count: form.repeat_count ? Number(form.repeat_count) : null,
      }, form.scheduled_date)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar preventivo" : "Nuevo preventivo"}
            {isOccurrenceOfSeries && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                <Repeat className="h-3 w-3" />
                {isSeriesParent ? "Padre de la serie" : "Ocurrencia de una serie"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <Label>Fecha programada *</Label>
            <Input type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
          </div>
          <div className="col-span-1">
            <Label>Tipo *</Label>
            <Select value={form.preventive_type} onValueChange={(v) => setForm((f) => ({ ...f, preventive_type: v as PreventiveType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PREVENTIVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Código equipo *</Label>
            <SearchSelect value={form.equipment_code} onChange={onEquipmentChange} options={opts} placeholder="Buscar equipo..." />
          </div>
          <div className="col-span-2">
            <Label>Nombre equipo</Label>
            <Input value={form.equipment_name} readOnly className="bg-muted" />
          </div>
          <div className="col-span-2">
            <Label>Tarea preventiva *</Label>
            <Input value={form.task_name} onChange={(e) => setForm((f) => ({ ...f, task_name: e.target.value }))} placeholder="Ej: Cambio de aceite" />
          </div>
          <div className="col-span-1">
            <Label>Frecuencia / referencia</Label>
            <Input value={form.frequency_label} onChange={(e) => setForm((f) => ({ ...f, frequency_label: e.target.value }))} placeholder="Ej: 6000 hs, 6 meses" />
          </div>
          <div className="col-span-1">
            <Label>Estado *</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PreventiveStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PREVENTIVE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label>Horas estimadas</Label>
            <Input type="number" step="0.5" value={form.estimated_hours} onChange={(e) => setForm((f) => ({ ...f, estimated_hours: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Observaciones</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* ============ Repetición ============ */}
          <div className="col-span-2 border-t pt-3 mt-1">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Repeat className="h-4 w-4" /> Repetición del preventivo
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Repetir automáticamente</span>
                <Switch
                  checked={form.repeat_enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, repeat_enabled: !!v }))}
                  disabled={!!item && !isSeriesParent && isOccurrenceOfSeries}
                />
              </div>
            </div>
            {!!item && !isSeriesParent && isOccurrenceOfSeries && (
              <p className="text-xs text-muted-foreground mt-1">
                Esta es una ocurrencia individual. Para cambiar la repetición, edite el preventivo padre o use "Guardar toda la serie".
              </p>
            )}

            {form.repeat_enabled && (
              <div className="mt-3 space-y-3 pl-1">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Repetir cada</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={form.repeat_every}
                      onChange={(e) => setForm((f) => ({ ...f, repeat_every: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Unidad</Label>
                    <Select value={form.repeat_unit} onValueChange={(v) => setForm((f) => ({ ...f, repeat_unit: v as RepeatUnit }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Días</SelectItem>
                        <SelectItem value="week">Semanas</SelectItem>
                        <SelectItem value="month">Meses</SelectItem>
                        <SelectItem value="year">Años</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-1 block">Finalización</Label>
                  <RadioGroup
                    value={form.repeat_end_mode}
                    onValueChange={(v) => setForm((f) => ({ ...f, repeat_end_mode: v as RepeatEndMode }))}
                    className="space-y-2"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="never" /> Sin fecha de finalización
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="until" /> Hasta una fecha
                      <Input
                        type="date"
                        className="h-8 w-44 ml-1"
                        value={form.repeat_end_date}
                        disabled={form.repeat_end_mode !== "until"}
                        onChange={(e) => setForm((f) => ({ ...f, repeat_end_date: e.target.value }))}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="count" /> Cantidad de repeticiones
                      <Input
                        type="number"
                        min={2}
                        step={1}
                        className="h-8 w-24 ml-1"
                        value={form.repeat_count}
                        disabled={form.repeat_end_mode !== "count"}
                        onChange={(e) => setForm((f) => ({ ...f, repeat_count: e.target.value }))}
                      />
                    </label>
                  </RadioGroup>
                </div>

                {ruleHint && (
                  <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    {ruleHint}. Se generan hasta 24 meses adelante y se completan automáticamente al abrir Preventivos.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============ Materiales necesarios ============ */}
          <div className="col-span-2 border-t pt-3 mt-1">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4" /> Materiales necesarios <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setMaterials((ms) => [...ms, mkMat()])}>
                <Plus className="h-3 w-3" /> Agregar material
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Se copiarán automáticamente a la OIT al generarla como "Materiales previstos".
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs border rounded">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2 w-28">Código</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 w-24">Cantidad</th>
                    <th className="p-2 w-28">Unidad</th>
                    <th className="p-2">Observaciones</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-3 text-center text-muted-foreground">
                        Sin materiales cargados
                      </td>
                    </tr>
                  )}
                  {materials.map((m, i) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-1">
                        <Input className="h-8" value={m.codigo} onChange={(e) => setMaterials((ms) => ms.map((x, ix) => ix === i ? { ...x, codigo: e.target.value } : x))} />
                      </td>
                      <td className="p-1">
                        <Input className="h-8" value={m.descripcion} onChange={(e) => setMaterials((ms) => ms.map((x, ix) => ix === i ? { ...x, descripcion: e.target.value } : x))} />
                      </td>
                      <td className="p-1">
                        <Input className="h-8" type="number" min={0} step="any" value={m.cantidad}
                          onChange={(e) => setMaterials((ms) => ms.map((x, ix) => ix === i ? { ...x, cantidad: e.target.value === "" ? "" : Number(e.target.value) } : x))} />
                      </td>
                      <td className="p-1">
                        <Input className="h-8" list="material-units" value={m.unidad ?? ""} placeholder="unidad"
                          onChange={(e) => setMaterials((ms) => ms.map((x, ix) => ix === i ? { ...x, unidad: e.target.value } : x))} />
                      </td>
                      <td className="p-1">
                        <Input className="h-8" value={m.observaciones ?? ""} onChange={(e) => setMaterials((ms) => ms.map((x, ix) => ix === i ? { ...x, observaciones: e.target.value } : x))} />
                      </td>
                      <td className="p-1">
                        <Button type="button" size="icon" variant="ghost" onClick={() => setMaterials((ms) => ms.filter((_, ix) => ix !== i))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="material-units">
                {MATERIAL_UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>
        </div>


        <DialogFooter className="gap-2 flex-wrap">
          {item && isOccurrenceOfSeries && (
            <>
              <Button variant="outline" className="text-red-700" onClick={handleCancelOccurrence} disabled={saving}>
                Cancelar esta ocurrencia
              </Button>
              <Button variant="outline" className="text-red-700" onClick={handleCancelFutureSeries} disabled={saving}>
                Cancelar serie futura
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cerrar</Button>
          {!item && (
            <Button variant="secondary" onClick={() => save("new-and-another")} disabled={saving}>
              Guardar y cargar otro
            </Button>
          )}
          {item && isOccurrenceOfSeries ? (
            <>
              <Button variant="secondary" onClick={() => save("single")} disabled={saving}>
                Guardar solo esta
              </Button>
              <Button onClick={() => save("series")} disabled={saving}>
                {saving ? "Guardando..." : "Guardar toda la serie"}
              </Button>
            </>
          ) : (
            <Button onClick={() => save("single")} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
