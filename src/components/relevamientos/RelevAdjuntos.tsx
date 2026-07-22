import { useEffect, useRef, useState } from "react";
import {
  listRelevAdjuntos, uploadRelevAdjunto, deleteRelevAdjunto,
  getRelevAdjuntoUrl, validateRelevFile, MAX_RELEV_FILES,
} from "@/lib/relevamientos/api";
import type { RelevAdjunto } from "@/lib/relevamientos/types";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Download, Eye, FileText, Image as ImageIcon, Video, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  relevamientoId: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;
const iconOf = (m: string) =>
  m.startsWith("image/") ? ImageIcon : m.startsWith("video/") ? Video : FileText;

export function RelevAdjuntos({ relevamientoId, canEdit, canDelete }: Props) {
  const [items, setItems] = useState<RelevAdjunto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (!relevamientoId) { setItems([]); return; }
    setLoading(true);
    try { setItems(await listRelevAdjuntos(relevamientoId)); }
    catch (e: any) { toast.error(e.message || "Error al cargar adjuntos"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [relevamientoId]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!relevamientoId) { toast.error("Guardá el relevamiento antes de adjuntar."); return; }
    const arr = Array.from(files);
    if (items.length + arr.length > MAX_RELEV_FILES) {
      toast.error(`Máximo ${MAX_RELEV_FILES} archivos por relevamiento.`); return;
    }
    setUploading(true);
    let ok = 0;
    for (const f of arr) {
      const err = validateRelevFile(f);
      if (err) { toast.error(`${f.name}: ${err}`); continue; }
      try { await uploadRelevAdjunto(relevamientoId, f); ok++; }
      catch (e: any) { toast.error(`Error al subir ${f.name}: ${e.message || ""}`); }
    }
    if (ok) toast.success(`${ok} archivo(s) cargado(s).`);
    setUploading(false);
    await reload();
  };

  const onOpen = async (a: RelevAdjunto) => {
    try { window.open(await getRelevAdjuntoUrl(a), "_blank"); }
    catch (e: any) { toast.error(e.message); }
  };
  const onDownload = async (a: RelevAdjunto) => {
    try { window.open(await getRelevAdjuntoUrl(a, true), "_blank"); }
    catch (e: any) { toast.error(e.message); }
  };
  const onDelete = async (a: RelevAdjunto) => {
    try { await deleteRelevAdjunto(a); toast.success("Archivo eliminado."); await reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className={`border-2 border-dashed rounded-md p-4 text-center ${!relevamientoId ? "opacity-60" : ""}`}>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files) { handleFiles(e.target.files); e.target.value = ""; } }}
          />
          <Paperclip className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Adjuntar fotos, videos o PDFs</p>
          <p className="text-xs text-muted-foreground mb-3">
            Opcional. Máximo {MAX_RELEV_FILES} archivos, 25 MB cada uno.
          </p>
          <Button size="sm" variant="outline" disabled={!relevamientoId || uploading}
            onClick={() => inputRef.current?.click()} className="gap-2" type="button">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Subiendo..." : "Seleccionar archivos"}
          </Button>
          {!relevamientoId && (
            <p className="text-xs text-amber-600 mt-2">Guardá el relevamiento primero para adjuntar archivos.</p>
          )}
        </div>
      )}
      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-4">Cargando adjuntos...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">Sin archivos adjuntos</div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md">
          {items.map((a) => {
            const Icon = iconOf(a.mime_type);
            return (
              <li key={a.id} className="flex items-center gap-3 p-2">
                <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.original_file_name}</div>
                  <div className="text-xs text-muted-foreground">{a.mime_type} · {fmtSize(a.size_bytes)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => onOpen(a)} title="Ver"><Eye className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDownload(a)} title="Descargar"><Download className="h-4 w-4" /></Button>
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                        <AlertDialogDescription>Dejará de aparecer en el relevamiento.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(a)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
