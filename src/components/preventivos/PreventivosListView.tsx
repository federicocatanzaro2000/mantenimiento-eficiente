import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PreventiveItem, STATUS_COLORS, effectiveStatus } from "@/lib/preventiveManual/types";
import { cn } from "@/lib/utils";
import { Edit, ExternalLink, FilePlus, CheckCircle2, XCircle, Trash2 } from "lucide-react";

interface Props {
  items: PreventiveItem[];
  todayISO: string;
  canManage: boolean;
  onEdit: (it: PreventiveItem) => void;
  onCreateOIT: (it: PreventiveItem) => void;
  onViewOIT: (ordenId: string) => void;
  onMarkDone: (it: PreventiveItem) => void;
  onCancel: (it: PreventiveItem) => void;
  onSoftDelete: (it: PreventiveItem) => void;
}

export function PreventivosListView({ items, todayISO, canManage, onEdit, onCreateOIT, onViewOIT, onMarkDone, onCancel, onSoftDelete }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const slice = items.slice((page - 1) * pageSize, page * pageSize);

  if (items.length === 0) {
    return <div className="border rounded p-8 text-center text-muted-foreground">No hay preventivos con los filtros aplicados.</div>;
  }

  return (
    <div>
      <div className="border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Tarea</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>OIT</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((it) => {
              const st = effectiveStatus(it, todayISO);
              return (
                <TableRow key={it.id}>
                  <TableCell>{it.scheduled_date}</TableCell>
                  <TableCell className="font-mono">{it.equipment_code_snapshot}</TableCell>
                  <TableCell>{it.equipment_name_snapshot}</TableCell>
                  <TableCell>{it.task_name}</TableCell>
                  <TableCell>{it.frequency_label ?? ""}</TableCell>
                  <TableCell>{it.preventive_type}</TableCell>
                  <TableCell><span className={cn("px-2 py-0.5 rounded border text-xs font-semibold", STATUS_COLORS[st])}>{st}</span></TableCell>
                  <TableCell>{it.work_order_id ? <Button size="sm" variant="link" className="px-0" onClick={() => onViewOIT(it.work_order_id!)}><ExternalLink className="h-3 w-3 mr-1" />Ver</Button> : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canManage && <Button size="icon" variant="ghost" onClick={() => onEdit(it)} title="Editar"><Edit className="h-4 w-4" /></Button>}
                      {!it.work_order_id && canManage && st !== "Cancelado" && st !== "Realizado" && (
                        <Button size="icon" variant="ghost" onClick={() => onCreateOIT(it)} title="Crear OIT"><FilePlus className="h-4 w-4" /></Button>
                      )}
                      {canManage && st !== "Realizado" && (
                        <Button size="icon" variant="ghost" onClick={() => onMarkDone(it)} title="Marcar realizado"><CheckCircle2 className="h-4 w-4" /></Button>
                      )}
                      {canManage && st !== "Cancelado" && (
                        <Button size="icon" variant="ghost" onClick={() => onCancel(it)} title="Cancelar"><XCircle className="h-4 w-4" /></Button>
                      )}
                      {canManage && (
                        <Button size="icon" variant="ghost" onClick={() => onSoftDelete(it)} title="Desactivar"><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-3 text-sm">
          <span>Página {page} de {totalPages} ({items.length} preventivos)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
