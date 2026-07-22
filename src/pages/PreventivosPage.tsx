import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { SearchSelect } from "@/components/SearchSelect";
import { useAuth } from "@/hooks/useAuth";
import { canManagePreventivos } from "@/lib/permissions";
import { Equipment, listEquipment } from "@/lib/catalogos/api";
import { PreventiveItem, PREVENTIVE_TYPES, PREVENTIVE_STATUSES, effectiveStatus, MONTH_NAMES, todayISOArgentina, daysBetweenISO } from "@/lib/preventiveManual/types";
import { listPreventives, distinctYears, softDeletePreventive, markRealizado, cancelar, createOITFromPreventivo, topUpSeriesHorizon, cancelSeriesFuture } from "@/lib/preventiveManual/api";
import { exportYearToExcel } from "@/lib/preventiveManual/excelExport";
import { PreventivoFormDialog } from "@/components/preventivos/PreventivoFormDialog";
import { ImportExcelDialog } from "@/components/preventivos/ImportExcelDialog";
import { DuplicarAnioDialog } from "@/components/preventivos/DuplicarAnioDialog";
import { PreventivosGridView } from "@/components/preventivos/PreventivosGridView";
import { PreventivosCalendarView } from "@/components/preventivos/PreventivosCalendarView";
import { PreventivosListView } from "@/components/preventivos/PreventivosListView";
import { Plus, Upload, Download, Copy, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function PreventivosPage() {
  const { roles } = useAuth();
  const canManage = canManagePreventivos(roles);
  const navigate = useNavigate();

  const todayISO = todayISOArgentina();
  const currentYear = Number(todayISO.slice(0, 4));
  const currentMonth = Number(todayISO.slice(5, 7));

  const [year, setYear] = useState<number>(currentYear);
  const [calMonth, setCalMonth] = useState<number>(currentMonth);
  const [yearsWithData, setYearsWithData] = useState<number[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [items, setItems] = useState<PreventiveItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [fMonth, setFMonth] = useState<string>("");
  const [fCode, setFCode] = useState<string>("");
  const [fName, setFName] = useState<string>("");
  const [fType, setFType] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fOIT, setFOIT] = useState<string>(""); // "with"|"without"
  const [fSearch, setFSearch] = useState<string>("");

  const [view, setView] = useState<"excel" | "calendario" | "listado">("excel");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<PreventiveItem | null>(null);
  const [prefill, setPrefill] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [list, ys] = await Promise.all([
        listPreventives({ year, activeOnly: true }),
        distinctYears(),
      ]);
      setItems(list);
      setYearsWithData(ys);
    } catch (e: any) {
      toast({ title: "Error al cargar", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [year]);
  useEffect(() => { listEquipment(false).then(setEquipment).catch(() => {}); }, []);
  // Top-up: asegura ≥12 meses futuros de cada serie recurrente al abrir la página
  useEffect(() => {
    topUpSeriesHorizon().then((r) => { if (r.generated > 0) refresh(); }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const yearOptions = useMemo(() => {
    const s = new Set<number>(yearsWithData);
    s.add(currentYear);
    s.add(currentYear + 1);
    s.add(year);
    return Array.from(s).sort((a, b) => b - a);
  }, [yearsWithData, currentYear, year]);

  // Apply local filters
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (fMonth && it.scheduled_month !== Number(fMonth)) return false;
      if (fCode && it.equipment_code_snapshot !== fCode) return false;
      if (fName && !it.equipment_name_snapshot.toLowerCase().includes(fName.toLowerCase())) return false;
      if (fType && it.preventive_type !== fType) return false;
      if (fOIT === "with" && !it.work_order_id) return false;
      if (fOIT === "without" && it.work_order_id) return false;
      if (fSearch && !it.task_name.toLowerCase().includes(fSearch.toLowerCase())) return false;
      if (fStatus) {
        const st = effectiveStatus(it, todayISO);
        if (st !== fStatus) return false;
      }
      return true;
    });
  }, [items, fMonth, fCode, fName, fType, fStatus, fOIT, fSearch, todayISO]);

  // Indicators
  const indicators = useMemo(() => {
    const total = filtered.length;
    let vencidos = 0, prox7 = 0, prox30 = 0, conOIT = 0, sinOIT = 0, realizados = 0;
    const t = new Date(todayISO);
    for (const it of filtered) {
      const st = effectiveStatus(it, todayISO);
      if (st === "Vencido") vencidos++;
      if (st === "Realizado") realizados++;
      if (it.work_order_id) conOIT++; else sinOIT++;
      const d = new Date(it.scheduled_date);
      const diff = Math.round((+d - +t) / 86400000);
      if (diff >= 0 && diff <= 7) prox7++;
      if (diff >= 0 && diff <= 30) prox30++;
    }
    return { total, vencidos, prox7, prox30, conOIT, sinOIT, realizados };
  }, [filtered, todayISO]);

  const equipOpts = equipment.map((e) => ({ value: e.code, label: `${e.code} - ${e.name}` }));
  const nameOpts = Array.from(new Set(equipment.map((e) => e.name))).map((n) => ({ value: n, label: n }));

  function openNew(p?: any) {
    setEditItem(null);
    setPrefill(p ?? { year });
    setFormOpen(true);
  }
  function openEdit(it: PreventiveItem) {
    setEditItem(it);
    setPrefill(null);
    setFormOpen(true);
  }

  async function handleCreateOIT(it: PreventiveItem) {
    if (it.work_order_id) { navigate(`/orden/${it.work_order_id}`); return; }
    try {
      const id = await createOITFromPreventivo(it);
      toast({ title: "OIT creada" });
      await refresh();
      navigate(`/orden/${id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  function clearFilters() {
    setFMonth(""); setFCode(""); setFName(""); setFType(""); setFStatus(""); setFOIT(""); setFSearch("");
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Preventivos</h1>
            <p className="text-sm text-muted-foreground">Cronograma manual de mantenimiento preventivo por equipo</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" />Nuevo preventivo</Button>}
            {canManage && <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Importar Excel</Button>}
            <Button variant="outline" onClick={() => exportYearToExcel(year, filtered)} disabled={filtered.length === 0}><Download className="h-4 w-4 mr-1" />Exportar Excel</Button>
            {canManage && <Button variant="outline" onClick={() => setDupOpen(true)}><Copy className="h-4 w-4 mr-1" />Duplicar año</Button>}
            <Button variant="ghost" onClick={refresh}><RefreshCw className={"h-4 w-4 mr-1 " + (loading ? "animate-spin" : "")} />Refrescar</Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-sm">
            <div>
              <Label className="text-xs">Año</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mes</Label>
              <Select value={fMonth || "all"} onValueChange={(v) => setFMonth(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Código equipo</Label>
              <SearchSelect value={fCode} onChange={setFCode} options={equipOpts} placeholder="Todos" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Nombre equipo</Label>
              <SearchSelect value={fName} onChange={setFName} options={nameOpts} placeholder="Todos" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={fType || "all"} onValueChange={(v) => setFType(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PREVENTIVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={fStatus || "all"} onValueChange={(v) => setFStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {["Programado", "Vencido", ...PREVENTIVE_STATUSES.filter((s) => s !== "Programado")].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">OIT</Label>
              <Select value={fOIT || "all"} onValueChange={(v) => setFOIT(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with">Con OIT</SelectItem>
                  <SelectItem value="without">Sin OIT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 lg:col-span-3">
              <Label className="text-xs">Buscar tarea</Label>
              <Input className="h-9" value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Texto de la tarea..." />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { l: "Total", v: indicators.total, c: "bg-secondary" },
            { l: "Vencidos", v: indicators.vencidos, c: "bg-red-100 text-red-800" },
            { l: "Próx 7d", v: indicators.prox7, c: "bg-amber-100 text-amber-800" },
            { l: "Próx 30d", v: indicators.prox30, c: "bg-yellow-50 text-yellow-800" },
            { l: "Con OIT", v: indicators.conOIT, c: "bg-blue-100 text-blue-800" },
            { l: "Sin OIT", v: indicators.sinOIT, c: "bg-slate-100 text-slate-800" },
            { l: "Realizados", v: indicators.realizados, c: "bg-emerald-100 text-emerald-800" },
          ].map((i) => (
            <div key={i.l} className={`rounded border p-2 text-center ${i.c}`}>
              <div className="text-xs">{i.l}</div>
              <div className="text-2xl font-bold">{i.v}</div>
            </div>
          ))}
        </div>

        {/* Views */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="excel">Excel</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
            <TabsTrigger value="listado">Listado</TabsTrigger>
          </TabsList>
          <TabsContent value="excel">
            <PreventivosGridView
              items={filtered}
              year={year}
              todayISO={todayISO}
              onCellClick={(code, name, month, day, existing) => {
                if (existing) { if (canManage) openEdit(existing); }
                else if (canManage) openNew({ year, month, equipment_code_snapshot: code, equipment_name_snapshot: name, equipment_id: equipment.find((e) => e.code === code)?.id ?? null, scheduled_date: `${year}-${String(month).padStart(2, "0")}-15` });
              }}
            />
          </TabsContent>
          <TabsContent value="calendario">
            <PreventivosCalendarView
              items={filtered}
              year={year}
              month={calMonth}
              setYear={setYear}
              setMonth={setCalMonth}
              todayISO={todayISO}
              onDayClick={(iso) => { if (canManage) openNew({ scheduled_date: iso, year: Number(iso.slice(0, 4)) }); }}
              onItemClick={(it) => openEdit(it)}
            />
          </TabsContent>
          <TabsContent value="listado">
            <PreventivosListView
              items={filtered}
              todayISO={todayISO}
              canManage={canManage}
              onEdit={openEdit}
              onCreateOIT={handleCreateOIT}
              onViewOIT={(id) => navigate(`/orden/${id}`)}
              onMarkDone={async (it) => { await markRealizado(it.id); toast({ title: "Marcado realizado" }); refresh(); }}
              onCancel={async (it) => { await cancelar(it.id); toast({ title: "Preventivo cancelado" }); refresh(); }}
              onSoftDelete={async (it) => {
                if (!confirm("¿Desactivar este preventivo?")) return;
                if (it.is_recurrence_parent && confirm("¿Cancelar también todas las ocurrencias futuras pendientes de la serie?")) {
                  await cancelSeriesFuture(it.id);
                }
                await softDeletePreventive(it.id);
                toast({ title: "Desactivado" });
                refresh();
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <PreventivoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        prefill={prefill}
        onSaved={refresh}
      />
      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />
      <DuplicarAnioDialog open={dupOpen} onOpenChange={setDupOpen} years={yearOptions} defaultFrom={year} onDone={refresh} />
    </AppLayout>
  );
}
