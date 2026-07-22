import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { SearchSelect, SearchOption } from "@/components/SearchSelect";
import { useAuth } from "@/hooks/useAuth";
import {
  createRelevamiento, listCatalogo, uploadRelevAdjunto, validateRelevFile,
} from "@/lib/relevamientos/api";
import {
  CatalogoInvolucrado, InvolucradoTipo, MAX_RELEV_FILES, PRIORIDAD_COLORS, RelevPrioridad,
} from "@/lib/relevamientos/types";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<InvolucradoTipo, string> = {
  equipo: "Equipo", linea: "Línea", sector: "Sector",
};

export default function RelevamientoNuevo() {
  const nav = useNavigate();
  const { user, nombre } = useAuth();
  const [catalogo, setCatalogo] = useState<CatalogoInvolucrado[]>([]);
  const [solicitante, setSolicitante] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [involucradoId, setInvolucradoId] = useState("");
  const [prioridad, setPrioridad] = useState<RelevPrioridad | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { listCatalogo(true).then(setCatalogo).catch((e) => toast.error(e.message)); }, []);
  useEffect(() => { if (nombre && !solicitante) setSolicitante(nombre); }, [nombre]); // eslint-disable-line

  const opts: SearchOption[] = useMemo(() => {
    const byTipo: Record<InvolucradoTipo, CatalogoInvolucrado[]> = { equipo: [], linea: [], sector: [] };
    catalogo.forEach((c) => byTipo[c.tipo].push(c));
    const out: SearchOption[] = [];
    (["equipo", "linea", "sector"] as InvolucradoTipo[]).forEach((t) => {
      byTipo[t].forEach((c) => out.push({
        value: c.id,
        label: `${TIPO_LABEL[t]} – ${c.nombre}${c.codigo ? ` (${c.codigo})` : ""}`,
      }));
    });
    return out;
  }, [catalogo]);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const nextTotal = files.length + arr.length;
    if (nextTotal > MAX_RELEV_FILES) {
      toast.error(`Máximo ${MAX_RELEV_FILES} archivos.`); return;
    }
    const valid: File[] = [];
    arr.forEach((f) => {
      const err = validateRelevFile(f);
      if (err) toast.error(`${f.name}: ${err}`); else valid.push(f);
    });
    setFiles([...files, ...valid]);
  };
  const removeFile = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const validar = () => {
    const s = solicitante.trim().split(/\s+/);
    if (s.length < 2 || s.some((p) => p.length === 0)) return "Ingresá nombre y apellido del solicitante.";
    if (!descripcion.trim()) return "La descripción es obligatoria.";
    if (!involucradoId) return "Seleccioná el sector, línea o equipo involucrado.";
    if (!prioridad) return "Seleccioná una prioridad.";
    return null;
  };

  const guardar = async () => {
    const err = validar();
    if (err) { toast.error(err); return; }
    if (!user) { toast.error("Sesión no válida"); return; }
    setSaving(true);
    try {
      const inv = catalogo.find((c) => c.id === involucradoId)!;
      const rel = await createRelevamiento({
        solicitante: solicitante.trim(),
        descripcion: descripcion.trim(),
        involucrado_id: inv.id,
        involucrado_tipo: inv.tipo,
        involucrado_nombre: inv.nombre,
        prioridad: prioridad as RelevPrioridad,
      });
      // upload files
      let ok = 0;
      for (const f of files) {
        try { await uploadRelevAdjunto(rel.id, f); ok++; }
        catch (e: any) { toast.error(`Error al subir ${f.name}: ${e.message}`); }
      }
      toast.success(`Relevamiento ${rel.numero} registrado correctamente.${ok ? ` ${ok} archivo(s) cargado(s).` : ""}`);
      nav(`/relevamientos/${rel.id}`);
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar el relevamiento.");
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav("/relevamientos")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="text-xl font-semibold">Registrar hallazgo</h1>
        </div>

        <div className="bg-card border border-border rounded-md p-4 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Solicitante <span className="text-destructive">*</span></Label>
            <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Nombre y apellido" />
            <p className="text-xs text-muted-foreground">Nombre y apellido de quien detectó el hallazgo.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descripción del hallazgo <span className="text-destructive">*</span></Label>
            <Textarea rows={5} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa el problema, incumplimiento, riesgo u oportunidad de mejora detectada." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Sector, línea o equipo involucrado <span className="text-destructive">*</span></Label>
            <SearchSelect value={involucradoId} onChange={setInvolucradoId} options={opts}
              placeholder="Buscar equipo, línea o sector..." />
            {opts.length === 0 && (
              <p className="text-xs text-amber-600">
                No hay elementos en el catálogo. Pedile a un supervisor que los cargue en Catálogo de involucrados.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Prioridad <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {(["Alta", "Media", "Baja"] as RelevPrioridad[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrioridad(p)}
                  className={cn(
                    "border rounded-md py-3 text-sm font-medium transition-all",
                    prioridad === p
                      ? `${PRIORIDAD_COLORS[p]} border-transparent shadow`
                      : "bg-background border-border hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Archivos adjuntos</Label>
            <input
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              onChange={(e) => onFiles(e.target.files)}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:opacity-90"
            />
            <p className="text-xs text-muted-foreground">Opcional. Máximo {MAX_RELEV_FILES} archivos.</p>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeFile(i)}>Quitar</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button onClick={guardar} disabled={saving} className="w-full h-11 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando..." : "Guardar relevamiento"}
        </Button>
      </div>
    </AppLayout>
  );
}
