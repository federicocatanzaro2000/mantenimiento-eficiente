import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listEquipment } from "@/lib/catalogos/api";
import { parseExcelFile, ImportPreview } from "@/lib/preventiveManual/excelImport";
import { bulkUpsertPreventives } from "@/lib/preventiveManual/api";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onImported: () => void; }

export function ImportExcelDialog({ open, onOpenChange, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function onFile(f: File) {
    setFile(f);
    setLoading(true);
    try {
      const eq = await listEquipment(false);
      const p = await parseExcelFile(f, eq);
      setPreview(p);
    } catch (e: any) {
      toast({ title: "Error al leer Excel", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await bulkUpsertPreventives(preview.toInsert);
      toast({
        title: "Importación finalizada",
        description: `${res.inserted} importados, ${res.skipped} omitidos por duplicados, ${preview.equipmentsNotFound.length} equipos no encontrados`,
      });
      onImported();
      onOpenChange(false);
      setFile(null);
      setPreview(null);
    } catch (e: any) {
      toast({ title: "Error en importación", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setFile(null); setPreview(null); } onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Importar preventivos desde Excel</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Procesando archivo...</div>}
          {preview && (
            <div className="text-sm space-y-2 border rounded p-3 bg-muted/30">
              <div><strong>Archivo:</strong> {file?.name}</div>
              <div><strong>Años detectados:</strong> {preview.yearsDetected.join(", ") || "ninguno"}</div>
              <div><strong>Preventivos detectados (a importar):</strong> {preview.totalDetected}</div>
              <div><strong>Equipos encontrados en catálogo:</strong> {preview.equipmentsFound.length}</div>
              {preview.equipmentsNotFound.length > 0 && (
                <div className="text-amber-700">
                  <strong>Equipos NO encontrados (preventivos omitidos):</strong> {preview.equipmentsNotFound.length}
                  <ul className="list-disc list-inside text-xs mt-1">
                    {preview.equipmentsNotFound.map((e) => <li key={e.code}>{e.rawLabel}</li>)}
                  </ul>
                </div>
              )}
              <div><strong>Filas ignoradas:</strong> {preview.ignoredRows}</div>
              {preview.errors.length > 0 && (
                <div className="text-red-700">
                  <strong>Errores:</strong>
                  <ul className="list-disc list-inside text-xs">{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              <div className="text-xs text-muted-foreground">La importación es idempotente: si importás el mismo archivo dos veces, los duplicados se omiten automáticamente.</div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!preview || importing || preview.totalDetected === 0} onClick={confirmImport}>
            {importing ? "Importando..." : `Importar ${preview?.totalDetected ?? 0} preventivos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
