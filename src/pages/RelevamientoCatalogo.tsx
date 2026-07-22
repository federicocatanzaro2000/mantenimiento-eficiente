import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { listCatalogo, createCatalogo, updateCatalogo } from "@/lib/relevamientos/api";
import { CatalogoInvolucrado, InvolucradoTipo } from "@/lib/relevamientos/types";
import { useAuth } from "@/hooks/useAuth";
import { canManageCatalogos } from "@/lib/permissions";

const TIPO_LABEL: Record<InvolucradoTipo, string> = { equipo: "Equipo", linea: "Línea", sector: "Sector" };

export default function RelevamientoCatalogo() {
  const nav = useNavigate();
  const { roles } = useAuth();
  const canEdit = canManageCatalogos(roles);
  const [items, setItems] = useState<CatalogoInvolucrado[]>([]);
  const [q, setQ] = useState("");
  const [fTipo, setFTipo] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CatalogoInvolucrado | null>(null);
  const [f, setF] = useState<{ nombre: string; tipo: InvolucradoTipo; codigo: string; descripcion: string; activo: boolean }>({
    nombre: "", tipo: "equipo", codigo: "", descripcion: "", activo: true,
  });

  const load = () => listCatalogo().then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setF({ nombre: "", tipo: "equipo", codigo: "", descripcion: "", activo: true }); setOpen(true); };
  const openEdit = (c: CatalogoInvolucrado) => {
    setEdit(c);
    setF({ nombre: c.nombre, tipo: c.tipo, codigo: c.codigo || "", descripcion: c.descripcion || "", activo: c.activo });
    setOpen(true);
  };
  const save = async () => {
    if (!f.nombre.trim()) return toast.error("Nombre obligatorio");
    try {
      if (edit) await updateCatalogo(edit.id, f);
      else await createCatalogo(f);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Ya existe un elemento activo con ese nombre y tipo" : e.message);
    }
  };
  const toggle = async (c: CatalogoInvolucrado) => {
    try { await updateCatalogo(c.id, { activo: !c.activo }); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const filtered = items.filter((c) =>
    (!fTipo || c.tipo === fTipo) &&
    (!q || c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.codigo || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => nav("/relevamientos")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="text-xl font-semibold">Catálogo de involucrados</h1>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={fTipo || "__all"} onValueChange={(v) => setFTipo(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              <SelectItem value="equipo">Equipos</SelectItem>
              <SelectItem value="linea">Líneas</SelectItem>
              <SelectItem value="sector">Sectores</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            {canEdit && <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Nuevo</Button>}
          </div>
        </div>

        <div className="border border-border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="w-24">Activo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin registros.</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{TIPO_LABEL[c.tipo]}</TableCell>
                  <TableCell>{c.nombre}</TableCell>
                  <TableCell className="font-mono text-xs">{c.codigo || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={c.activo} onCheckedChange={() => canEdit && toggle(c)} disabled={!canEdit} />
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? "Editar elemento" : "Nuevo elemento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v as InvolucradoTipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipo">Equipo</SelectItem>
                  <SelectItem value="linea">Línea</SelectItem>
                  <SelectItem value="sector">Sector</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Código (opcional)</Label>
              <Input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descripción (opcional)</Label>
              <Textarea rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={f.activo} onCheckedChange={(v) => setF({ ...f, activo: v })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
