import { useEffect, useRef, useState } from "react";
import {
  Attachment,
  listAttachments,
  uploadAttachment,
  softDeleteAttachment,
  getSignedUrl,
  validateFile,
  MAX_PER_OIT,
} from "@/lib/attachments/api";
import { Button } from "@/components/ui/button";
import {
  Upload, Trash2, Download, Eye, FileText, Image as ImageIcon, Loader2, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  workOrderId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onListChange?: (items: Attachment[]) => void;
}

const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;
const isImg = (m: string) => m.startsWith("image/");

export function OrdenAttachments({ workOrderId, canEdit, canDelete, onListChange }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (!workOrderId) {
      setItems([]);
      onListChange?.([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listAttachments(workOrderId);
      setItems(data);
      onListChange?.(data);
    } catch (e: any) {
      toast.error(e.message || "Error al cargar adjuntos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!workOrderId) {
      toast.error("Guardá la OIT antes de adjuntar archivos.");
      return;
    }
    const arr = Array.from(files);
    if (items.length + arr.length > MAX_PER_OIT) {
      toast.error(`Se permite un máximo de ${MAX_PER_OIT} archivos por OIT.`);
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const f of arr) {
      const err = validateFile(f);
      if (err) {
        toast.error(`${f.name}: ${err}`);
        continue;
      }
      try {
        await uploadAttachment(workOrderId, f);
        ok++;
      } catch (e: any) {
        toast.error(`Error al subir ${f.name}: ${e.message || ""}`);
      }
    }
    if (ok) toast.success(`${ok} archivo(s) cargado(s) correctamente.`);
    setUploading(false);
    await reload();
  };

  const onOpen = async (a: Attachment) => {
    try {
      const url = await getSignedUrl(a);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Error al abrir");
    }
  };

  const onDownload = async (a: Attachment) => {
    try {
      const url = await getSignedUrl(a, true);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Error al descargar");
    }
  };

  const onDelete = async (a: Attachment) => {
    try {
      await softDeleteAttachment(a);
      toast.success("Archivo eliminado.");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
  };

  return (
    <div className="space-y-3 no-print">
      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          } ${!workOrderId ? "opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <Paperclip className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Adjuntar fotos o PDFs relacionados con la OIT</p>
          <p className="text-xs text-muted-foreground mb-3">
            Campo opcional. Formatos permitidos: JPG, PNG, WEBP y PDF. Máx. 10 MB por archivo · hasta {MAX_PER_OIT} archivos por OIT.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={!workOrderId || uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-2"
            type="button"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Subiendo..." : "Seleccionar archivos"}
          </Button>
          {!workOrderId && (
            <p className="text-xs text-amber-600 mt-2">
              Guardá la OIT primero para poder adjuntar archivos.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-4">Cargando adjuntos...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">Sin archivos adjuntos</div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-2">
              <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                {isImg(a.mimeType) ? (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.originalFileName}</div>
                <div className="text-xs text-muted-foreground">
                  {a.mimeType} · {fmtSize(a.fileSize)}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onOpen(a)} title="Ver">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onDownload(a)} title="Descargar">
                <Download className="h-4 w-4" />
              </Button>
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" title="Eliminar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este archivo adjunto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        El archivo dejará de aparecer en la OIT.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(a)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
