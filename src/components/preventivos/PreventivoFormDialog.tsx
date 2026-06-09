import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/SearchSelect";
import { Equipment, listEquipment } from "@/lib/catalogos/api";
import { PreventiveItem, PreventiveItemInput, PREVENTIVE_TYPES, PREVENTIVE_STATUSES, PreventiveType, PreventiveStatus } from "@/lib/preventiveManual/types";
import { createPreventive, updatePreventive } from "@/lib/preventiveManual/api";
import { toast } from "@/hooks/use-toast";

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
});

export function PreventivoFormDialog({ open, onOpenChange, item, prefill, onSaved }: Props) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [form, setForm] = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      listEquipment(true).then(setEquipment).catch(() => {});
    }
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
      });
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
    return null;
  }

  async function save(continueLoading = false) {
    const err = validate();
    if (err) { toast({ title: "Error", description: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const input: PreventiveItemInput = {
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
      };
      if (item) {
        await updatePreventive(item.id, input);
        toast({ title: "Preventivo actualizado" });
      } else {
        await createPreventive(input);
        toast({ title: "Preventivo creado" });
      }
      onSaved();
      if (continueLoading) {
        // Keep equipment, type, frequency, year
        const y = form.scheduled_date.slice(0, 4);
        setForm((f) => ({ ...f, scheduled_date: `${y}-01-15`, task_name: "", notes: "" }));
      } else {
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar preventivo" : "Nuevo preventivo"}</DialogTitle>
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
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {!item && (
            <Button variant="secondary" onClick={() => save(true)} disabled={saving}>Guardar y cargar otro</Button>
          )}
          <Button onClick={() => save(false)} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
