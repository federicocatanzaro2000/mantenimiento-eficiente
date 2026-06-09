import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { duplicateYear } from "@/lib/preventiveManual/api";
import { toast } from "@/hooks/use-toast";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; years: number[]; defaultFrom?: number; onDone: () => void; }

export function DuplicarAnioDialog({ open, onOpenChange, years, defaultFrom, onDone }: Props) {
  const [from, setFrom] = useState<number>(defaultFrom ?? (years[0] ?? new Date().getFullYear()));
  const [to, setTo] = useState<number>(new Date().getFullYear() + 1);
  const [mode, setMode] = useState<"fechas" | "estructura" | "solo_equipos">("fechas");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (from === to) { toast({ title: "Año origen y destino no pueden ser iguales", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const res = await duplicateYear({ from, to, mode });
      toast({ title: "Año duplicado", description: `${res.inserted} preventivos creados, ${res.skipped} omitidos` });
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Duplicar año</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Año origen</Label>
            <Select value={String(from)} onValueChange={(v) => setFrom(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Año destino</Label>
            <Input type="number" min={2000} max={2100} value={to} onChange={(e) => setTo(Number(e.target.value))} />
          </div>
          <div>
            <Label>Modo</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fechas">Copiar estructura y fechas equivalentes</SelectItem>
                <SelectItem value="estructura">Copiar estructura (mismo mes/día)</SelectItem>
                <SelectItem value="solo_equipos">Solo equipos y tareas (sin fechas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">No se duplicarán preventivos que ya existan en el año destino.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy} onClick={run}>{busy ? "Duplicando..." : "Duplicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
