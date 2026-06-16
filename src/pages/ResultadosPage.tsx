import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { aplicarFiltros } from "@/lib/filterOrdenes";
import { paramsToFilters, hasActiveFilters } from "@/lib/filtersUrl";
import { filtrosVacios } from "@/types/orden";
import { Button } from "@/components/ui/button";
import { AprobadoBadge, CalidadBadge, EstadoBadge, PrioridadBadge } from "@/components/StatusBadges";
import { ArrowLeft, Download, Eye, Filter as FilterIcon, Printer, RotateCcw } from "lucide-react";
import { Orden } from "@/types/orden";

const cols: { k: keyof Orden | "acciones"; label: string }[] = [
  { k: "nroOrden", label: "Nro" },
  { k: "fechaCreacion", label: "F. Creación" },
  { k: "fechaInicio", label: "F. Inicio" },
  { k: "fechaFinalizacion", label: "F. Fin" },
  { k: "fechaLimiteRealizacion", label: "F. Límite" },
  { k: "tecnicoResponsable", label: "Técnico" },
  { k: "sector", label: "Sector" },
  { k: "tipoOrden", label: "Tipo" },
  { k: "aprobado", label: "Aprobado" },
  { k: "estado", label: "Estado" },
  { k: "prioridad", label: "Prioridad" },
  { k: "horasPresupuestadas", label: "Hs. Pres." },
  { k: "horasReales", label: "Hs. Real" },
  { k: "codigoDocumento", label: "Cód. Doc" },
  { k: "codigoEquipo", label: "Cód. Eq." },
  { k: "nombreEquipo", label: "Equipo" },
  { k: "solicitante", label: "Solicitante" },
  { k: "estadoRecepcionEquipo", label: "Recepción" },
  { k: "controlLiberacionCalidad", label: "Calidad" },
  { k: "responsableControlCalidad", label: "Resp. Cal." },
  { k: "elaboro", label: "Elaboró" },
  { k: "reviso", label: "Revisó" },
  { k: "aprobo", label: "Aprobó" },
  { k: "acciones", label: "Acciones" },
];

function exportCSV(rows: Orden[]) {
  const headers = cols.filter((c) => c.k !== "acciones").map((c) => c.label);
  const data = rows.map((o) =>
    cols.filter((c) => c.k !== "acciones").map((c) => {
      const v = (o as any)[c.k];
      if (typeof v === "boolean") return c.k === "aprobado" ? (v ? "Aprobado" : "No aprobado") : (v ? "SI" : "NO");
      return String(v ?? "");
    })
  );
  const csv = [headers, ...data]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ordenes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultadosPage() {
  const navigate = useNavigate();
  const { ordenes, filtros, resetFiltros, loaded, loadAll } = useOrdenesStore();
  useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);
  const resultados = useMemo(() => aplicarFiltros(ordenes, filtros), [ordenes, filtros]);

  const totals = useMemo(() => {
    const pres = resultados.reduce((s, o) => s + (Number(o.horasPresupuestadas) || 0), 0);
    const real = resultados.reduce((s, o) => s + (Number(o.horasReales) || 0), 0);
    return { pres, real, dif: real - pres };
  }, [resultados]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" />Listado</Button>
          <h2 className="text-xl font-semibold">Resultados filtrados</h2>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => navigate("/filtros")} className="gap-2"><FilterIcon className="h-4 w-4" />Volver a filtros</Button>
          <Button variant="outline" onClick={() => { resetFiltros(); }} className="gap-2"><RotateCcw className="h-4 w-4" />Limpiar filtros</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />Imprimir / PDF</Button>
          <Button onClick={() => exportCSV(resultados)} className="gap-2"><Download className="h-4 w-4" />Exportar CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { l: "Órdenes encontradas", v: resultados.length },
          { l: "Hs. presupuestadas", v: totals.pres },
          { l: "Hs. reales", v: totals.real },
          { l: "Diferencia (Real - Pres.)", v: totals.dif, color: totals.dif > 0 ? "text-destructive" : totals.dif < 0 ? "text-[hsl(var(--success))]" : "" },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-md p-4 shadow-sm">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">{c.l}</div>
            <div className={`text-2xl font-semibold mt-1 tabular-nums ${(c as any).color || ""}`}>{c.v}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-md shadow-sm overflow-x-auto">
        <table className="erp-table">
          <thead>
            <tr>{cols.map((c) => <th key={c.k as string}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {resultados.length === 0 && (
              <tr><td colSpan={cols.length} className="text-center py-8 text-muted-foreground">Sin resultados con los filtros aplicados</td></tr>
            )}
            {resultados.map((o) => (
              <tr key={o.id}>
                <td className="font-mono font-semibold">{o.nroOrden}</td>
                <td>{o.fechaCreacion}</td>
                <td>{o.fechaInicio || "—"}</td>
                <td>{o.fechaFinalizacion || "—"}</td>
                <td>{o.fechaLimiteRealizacion || "—"}</td>
                <td>{o.tecnicoResponsable}</td>
                <td>{o.sector}</td>
                <td>{o.tipoOrden}</td>
                <td><AprobadoBadge aprobado={o.aprobado} /></td>
                <td><EstadoBadge estado={o.estado} /></td>
                <td><PrioridadBadge prioridad={o.prioridad} /></td>
                <td className="text-right tabular-nums">{o.horasPresupuestadas}</td>
                <td className="text-right tabular-nums">{o.horasReales}</td>
                <td>{o.codigoDocumento}</td>
                <td>{o.codigoEquipo}</td>
                <td>{o.nombreEquipo}</td>
                <td>{o.solicitante}</td>
                <td>{o.estadoRecepcionEquipo || "—"}</td>
                <td><CalidadBadge ok={o.controlLiberacionCalidad} /></td>
                <td>{o.responsableControlCalidad}</td>
                <td>{o.elaboro}</td>
                <td>{o.reviso}</td>
                <td>{o.aprobo}</td>
                <td>
                  <Button size="icon" variant="ghost" onClick={() => navigate(`/orden/${o.id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
