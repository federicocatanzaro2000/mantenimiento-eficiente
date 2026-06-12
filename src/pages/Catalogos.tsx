import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canManageCatalogos } from "@/lib/permissions";
import {
  Sector, Person, Equipment, OrderType,
  listSectors, createSector, updateSector,
  listPeople, createPerson, updatePerson,
  listEquipment, createEquipment, updateEquipment,
  listOrderTypes, createOrderType, updateOrderType,
} from "@/lib/catalogos/api";

function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input placeholder="Buscar..." value={value} onChange={(e) => onChange(e.target.value)} className="max-w-xs" />;
}

function SectoresTab({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Sector[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Sector | null>(null);
  const [name, setName] = useState(""); const [sort, setSort] = useState(0);
  const load = () => listSectors().then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const openNew = () => { setEdit(null); setName(""); setSort((items.at(-1)?.sort_order ?? 0) + 10); setOpen(true); };
  const openEdit = (s: Sector) => { setEdit(s); setName(s.name); setSort(s.sort_order); setOpen(true); };
  const save = async () => {
    if (!name.trim()) return toast.error("Nombre obligatorio");
    try {
      if (edit) await updateSector(edit.id, { name, sort_order: sort });
      else await createSector(name, sort);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Ya existe un sector con ese nombre" : e.message);
    }
  };
  const toggle = async (s: Sector) => {
    try { await updateSector(s.id, { active: !s.active }); load(); } catch (e: any) { toast.error(e.message); }
  };
  const filtered = items.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Search value={q} onChange={setQ} />
        {canEdit && <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Agregar sector</Button>}
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead className="w-24">Orden</TableHead><TableHead className="w-32">Activo</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin resultados</TableCell></TableRow>}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className={!s.active ? "text-muted-foreground line-through" : ""}>{s.name}</TableCell>
                <TableCell>{s.sort_order}</TableCell>
                <TableCell><Switch checked={s.active} onCheckedChange={() => toggle(s)} disabled={!canEdit} /></TableCell>
                <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar sector" : "Nuevo sector"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Orden</Label><Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value) || 0)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PERSON_PERMS: { key: keyof Person; label: string }[] = [
  { key: "can_be_requester", label: "Solicitante" },
  { key: "can_be_technician", label: "Técnico" },
  { key: "can_be_quality_responsible", label: "Resp. Calidad" },
  { key: "can_be_created_by", label: "Elaboró" },
  { key: "can_be_reviewed_by", label: "Revisó" },
  { key: "can_be_approver", label: "Aprobó" },
];

function PersonasTab({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Person | null>(null);
  const [form, setForm] = useState<Omit<Person, "id">>({
    full_name: "", active: true,
    can_be_requester: true, can_be_technician: true, can_be_quality_responsible: true,
    can_be_created_by: true, can_be_reviewed_by: true, can_be_approver: false,
  });
  const load = () => listPeople().then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const openNew = () => { setEdit(null); setForm({ full_name: "", active: true, can_be_requester: true, can_be_technician: true, can_be_quality_responsible: true, can_be_created_by: true, can_be_reviewed_by: true, can_be_approver: false }); setOpen(true); };
  const openEdit = (p: Person) => { setEdit(p); const { id, ...rest } = p; setForm(rest); setOpen(true); };
  const save = async () => {
    if (!form.full_name.trim()) return toast.error("Nombre obligatorio");
    try {
      if (edit) await updatePerson(edit.id, form); else await createPerson(form);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Ya existe una persona con ese nombre" : e.message);
    }
  };
  const toggle = async (p: Person) => { try { await updatePerson(p.id, { active: !p.active }); load(); } catch (e: any) { toast.error(e.message); } };
  const filtered = items.filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Search value={q} onChange={setQ} />
        {canEdit && <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Agregar persona</Button>}
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead>{PERSON_PERMS.map((p) => <TableHead key={p.key} className="text-center">{p.label}</TableHead>)}<TableHead className="w-24 text-center">Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin resultados</TableCell></TableRow>}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className={!p.active ? "text-muted-foreground line-through" : ""}>{p.full_name}</TableCell>
                {PERSON_PERMS.map((perm) => <TableCell key={perm.key} className="text-center">{(p as any)[perm.key] ? "✓" : ""}</TableCell>)}
                <TableCell className="text-center"><Switch checked={p.active} onCheckedChange={() => toggle(p)} disabled={!canEdit} /></TableCell>
                <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar persona" : "Nueva persona"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Puede figurar como:</Label>
              {PERSON_PERMS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(form as any)[p.key]} onCheckedChange={(v) => setForm({ ...form, [p.key]: !!v } as any)} />
                  {p.label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm pt-2 border-t">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Activo
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EquiposTab({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Equipment | null>(null);
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const load = () => listEquipment().then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const openNew = () => { setEdit(null); setCode(""); setName(""); setOpen(true); };
  const openEdit = (e: Equipment) => { setEdit(e); setCode(e.code); setName(e.name); setOpen(true); };
  const save = async () => {
    if (!code.trim() || !name.trim()) return toast.error("Código y nombre son obligatorios");
    try {
      if (edit) await updateEquipment(edit.id, { code, name }); else await createEquipment(code, name);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Ya existe un equipo con ese código" : e.message);
    }
  };
  const toggle = async (e: Equipment) => { try { await updateEquipment(e.id, { active: !e.active }); load(); } catch (err: any) { toast.error(err.message); } };
  const ql = q.toLowerCase();
  const filtered = items.filter((e) => e.code.toLowerCase().includes(ql) || e.name.toLowerCase().includes(ql));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Search value={q} onChange={setQ} />
        {canEdit && <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Agregar equipo</Button>}
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead className="w-40">Código</TableHead><TableHead>Nombre</TableHead><TableHead className="w-32">Activo</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin resultados</TableCell></TableRow>}
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell className={`font-mono ${!e.active ? "text-muted-foreground line-through" : ""}`}>{e.code}</TableCell>
                <TableCell className={!e.active ? "text-muted-foreground line-through" : ""}>{e.name}</TableCell>
                <TableCell><Switch checked={e.active} onCheckedChange={() => toggle(e)} disabled={!canEdit} /></TableCell>
                <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar equipo" : "Nuevo equipo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Código</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TiposOrdenTab({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<OrderType[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<OrderType | null>(null);
  const [form, setForm] = useState<Omit<OrderType, "id">>({
    name: "", active: true, sort_order: 0, color: null, description: null,
    requires_line_stoppage_question: false,
  });
  const load = () => listOrderTypes().then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const openNew = () => {
    setEdit(null);
    setForm({
      name: "", active: true,
      sort_order: (items.at(-1)?.sort_order ?? 0) + 10,
      color: null, description: null, requires_line_stoppage_question: false,
    });
    setOpen(true);
  };
  const openEdit = (t: OrderType) => {
    setEdit(t);
    const { id, ...rest } = t;
    setForm(rest);
    setOpen(true);
  };
  const save = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("Nombre obligatorio");
    const dup = items.some((t) =>
      t.id !== edit?.id && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) return toast.error("Ya existe un tipo con ese nombre");
    try {
      if (edit) await updateOrderType(edit.id, form);
      else await createOrderType(form);
      toast.success("Guardado"); setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Ya existe un tipo con ese nombre" : e.message);
    }
  };
  const toggle = async (t: OrderType) => {
    try { await updateOrderType(t.id, { active: !t.active }); load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const filtered = items.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Search value={q} onChange={setQ} />
        {canEdit && <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Agregar tipo</Button>}
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-24">Orden</TableHead>
              <TableHead className="w-28">Color</TableHead>
              <TableHead className="text-center w-44">Pregunta línea parada</TableHead>
              <TableHead className="w-24 text-center">Activo</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin resultados</TableCell></TableRow>}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className={!t.active ? "text-muted-foreground line-through" : ""}>{t.name}</TableCell>
                <TableCell>{t.sort_order}</TableCell>
                <TableCell>
                  {t.color ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: t.color }} />
                      <span className="text-xs text-muted-foreground">{t.color}</span>
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">{t.requires_line_stoppage_question ? "Sí" : "No"}</TableCell>
                <TableCell className="text-center"><Switch checked={t.active} onCheckedChange={() => toggle(t)} disabled={!canEdit} /></TableCell>
                <TableCell>{canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar tipo de orden" : "Nuevo tipo de orden"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Orden</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} /></div>
              <div>
                <Label>Color (opcional)</Label>
                <Input type="text" placeholder="#1e90ff o hsl(...)" value={form.color ?? ""} onChange={(e) => setForm({ ...form, color: e.target.value || null })} />
              </div>
            </div>
            <div><Label>Descripción (opcional)</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value || null })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.requires_line_stoppage_question} onCheckedChange={(v) => setForm({ ...form, requires_line_stoppage_question: !!v })} />
              Requiere preguntar "¿Se paró la línea?" en la OIT
            </label>
            <label className="flex items-center gap-2 text-sm pt-2 border-t">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Activo
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Catalogos() {
  const { roles } = useAuth();
  const canEdit = canManageCatalogos(roles);
  return (
    <AppLayout>
      <h2 className="text-xl font-semibold mb-4">Catálogos</h2>
      <Tabs defaultValue="sectores">
        <TabsList>
          <TabsTrigger value="sectores">Sectores</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="equipos">Equipos / Máquinas</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de orden</TabsTrigger>
        </TabsList>
        <TabsContent value="sectores" className="mt-4"><SectoresTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="personas" className="mt-4"><PersonasTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="equipos" className="mt-4"><EquiposTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="tipos" className="mt-4"><TiposOrdenTab canEdit={canEdit} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
