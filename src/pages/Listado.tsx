import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrdenesStore } from "@/store/ordenesStore";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AprobadoBadge, EstadoBadge, PrioridadBadge } from "@/components/StatusBadges";
import { ArrowUpDown, Eye, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Orden } from "@/types/orden";
import { useAuth } from "@/hooks/useAuth";
import { canCreateOrden, canDeleteOrden } from "@/lib/permissions";
import { toast } from "sonner";

type SortKey = keyof Orden | "aprobadoLabel" | "attachmentsCount";

export default function Listado() {
  const { ordenes, loadAll, loaded, loading, deleteOrden } = useOrdenesStore();
  const { roles } = useAuth();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nroOrden");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const navigate = useNavigate();

  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q ? ordenes : ordenes.filter((o) => {
      const aprobadoTxt = o.aprobado ? "aprobado" : "no aprobado";
      const materialesTxt = (o.materialesUtilizados ?? [])
        .map((m) => `${m.descripcion} ${m.codigo} ${m.cantidad}`)
        .join(" ");
      return [
        o.nroOrden,
        o.fechaCreacion,
        o.fechaInicio,
        o.fechaFinalizacion,
        o.fechaLimiteRealizacion,
        aprobadoTxt,
        o.sector,
        o.tipoOrden,
        o.estado,
        o.tecnicoResponsable,
        o.prioridad,
        o.horasPresupuestadas,
        o.horasReales,
        o.codigoEquipo,
        o.nombreEquipo,
        o.solicitante,
        o.descripcionProblema,
        o.trabajoSolicitado,
        o.codigoDocumento,
        o.responsableControlCalidad,
        o.elaboro,
        o.reviso,
        o.aprobo,
        o.observaciones,
        o.estadoRecepcionEquipo,
        materialesTxt,
      ].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
    const sorted = [...list].sort((a, b) => {
      const av = sortKey === "aprobadoLabel" ? (a.aprobado ? 1 : 0) : (a as any)[sortKey];
      const bv = sortKey === "aprobadoLabel" ? (b.aprobado ? 1 : 0) : (b as any)[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [ordenes, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const onDelete = async (id: string, nro: number | "") => {
    try {
      await deleteOrden(id);
      toast.success(`Orden #${nro} eliminada`);
    } catch (e: any) {
      toast.error(e.message || "No se pudo eliminar");
    }
  };

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:opacity-80">
        {children} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  const puedeCrear = canCreateOrden(roles);
  const puedeEliminar = canDeleteOrden(roles);

  return (
    <AppLayout>
      <div className="bg-card border border-border rounded-md shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, fecha, sector, técnico, estado, prioridad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {puedeCrear && (
            <Button onClick={() => navigate("/orden/nueva")} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva Orden
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <Th k="nroOrden">Nro. Orden</Th>
                <Th k="fechaCreacion">Fecha Creación</Th>
                <Th k="aprobadoLabel">Aprobado</Th>
                <Th k="codigoEquipo">Código Equipo</Th>
                <Th k="sector">Sector</Th>
                <Th k="tipoOrden">Tipo</Th>
                <Th k="estado">Estado</Th>
                <Th k="tecnicoResponsable">Técnico</Th>
                <Th k="prioridad">Prioridad</Th>
                <Th k="horasPresupuestadas">Hs. Presup.</Th>
                <Th k="horasReales">Hs. Reales</Th>
                <Th k="attachmentsCount">Adj.</Th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">Cargando...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="cursor-pointer" onClick={() => navigate(`/orden/${o.id}`)}>
                  <td className="font-mono font-semibold">{o.nroOrden}</td>
                  <td>{o.fechaCreacion}</td>
                  <td><AprobadoBadge aprobado={o.aprobado} /></td>
                  <td>{o.codigoEquipo}</td>
                  <td>{o.sector}</td>
                  <td>{o.tipoOrden}</td>
                  <td><EstadoBadge estado={o.estado} /></td>
                  <td>
                    {((o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
                      ? o.tecnicosResponsables
                      : (o.tecnicoResponsable ? [o.tecnicoResponsable] : [])
                    ).map((t, i) => (
                      <span key={i} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 text-[11px] bg-secondary rounded">{t}</span>
                    ))}
                  </td>
                  <td><PrioridadBadge prioridad={o.prioridad} /></td>
                  <td className="text-right tabular-nums">{o.horasPresupuestadas}</td>
                  <td className="text-right tabular-nums">{o.horasReales}</td>
                  <td className="text-center">
                    {(o.attachmentsCount ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${o.attachmentsCount} adjunto(s)`}>
                        <Paperclip className="h-3.5 w-3.5" />{o.attachmentsCount}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/orden/${o.id}`)} title="Ver/Editar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/orden/${o.id}`)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {puedeEliminar && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title="Eliminar">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar orden #{o.nroOrden}</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. ¿Confirma la eliminación?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(o.id, o.nroOrden)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-xs text-muted-foreground border-t border-border">
          Mostrando {filtered.length} de {ordenes.length} órdenes
        </div>
      </div>
    </AppLayout>
  );
}
