import { Orden, Filtros } from "@/types/orden";

const inRange = (v: string, from: string, to: string) => {
  if (!v) return !from && !to;
  if (from && v < from) return false;
  if (to && v > to) return false;
  return true;
};

const numIn = (v: number | "", min: string, max: string) => {
  if (v === "") return !min && !max;
  if (min !== "" && v < Number(min)) return false;
  if (max !== "" && v > Number(max)) return false;
  return true;
};

const txt = (v: string, q: string) => !q || (v ?? "").toLowerCase().includes(q.toLowerCase());

export function aplicarFiltros(ordenes: Orden[], f: Filtros): Orden[] {
  return ordenes.filter((o) => {
    if (!inRange(o.fechaCreacion, f.fechaCreacionDesde, f.fechaCreacionHasta)) return false;
    if (!inRange(o.fechaInicio, f.fechaInicioDesde, f.fechaInicioHasta)) return false;
    if (!inRange(o.fechaFinalizacion, f.fechaFinDesde, f.fechaFinHasta)) return false;
    if (!inRange(o.fechaLimiteRealizacion, f.fechaLimiteDesde, f.fechaLimiteHasta)) return false;
    if (f.tecnicoResponsable) {
      const q = f.tecnicoResponsable.toLowerCase().trim();
      const arr = (o.tecnicosResponsables && o.tecnicosResponsables.length > 0)
        ? o.tecnicosResponsables
        : (o.tecnicoResponsable ? [o.tecnicoResponsable] : []);
      if (!arr.some((t) => (t ?? "").toLowerCase().includes(q))) return false;
    }
    if (!txt(o.sector, f.sector)) return false;
    if (f.tipoOrden.length && !f.tipoOrden.includes(o.tipoOrden as any)) return false;
    if (f.aprobado === "Aprobadas" && !o.aprobado) return false;
    if (f.aprobado === "No aprobadas" && o.aprobado) return false;
    if (f.estado.length && !f.estado.includes(o.estado as any)) return false;
    if (f.prioridad.length && !f.prioridad.includes(o.prioridad as any)) return false;
    if (!numIn(o.horasPresupuestadas, f.horasPresupMin, f.horasPresupMax)) return false;
    if (!numIn(o.horasReales, f.horasRealesMin, f.horasRealesMax)) return false;
    if (!txt(o.codigoDocumento, f.codigoDocumento)) return false;
    if (!txt(o.codigoEquipo, f.codigoEquipo)) return false;
    if (!txt(o.nombreEquipo, f.nombreEquipo)) return false;
    if (f.nroOrden && String(o.nroOrden) !== f.nroOrden) return false;
    if (!txt(o.solicitante, f.solicitante)) return false;
    if (f.estadoRecepcionEquipo !== "Todos" && o.estadoRecepcionEquipo !== f.estadoRecepcionEquipo) return false;
    if (f.sectorLimpio === "Limpio" && !o.sectorLimpioOrdenado) return false;
    if (f.sectorLimpio === "No limpio" && o.sectorLimpioOrdenado) return false;
    if (f.herramientasLimpias === "Ordenado" && !o.herramientasLimpiasOrdenadas) return false;
    if (f.herramientasLimpias === "No ordenado" && o.herramientasLimpiasOrdenadas) return false;
    if (f.controlCalidad === "SI" && !o.controlLiberacionCalidad) return false;
    if (f.controlCalidad === "NO" && o.controlLiberacionCalidad) return false;
    if (!txt(o.responsableControlCalidad, f.responsableControlCalidad)) return false;
    if (!txt(o.elaboro, f.elaboro)) return false;
    if (!txt(o.reviso, f.reviso)) return false;
    if (!txt(o.aprobo, f.aprobo)) return false;
    if (f.lineStopped === "Si" && o.lineStopped !== true) return false;
    if (f.lineStopped === "No" && o.lineStopped !== false) return false;
    if (!numIn(o.lineStoppedHours, f.lineStoppedHorasMin, f.lineStoppedHorasMax)) return false;
    const n = o.attachmentsCount ?? 0;
    if (f.attachments === "Con" && n <= 0) return false;
    if (f.attachments === "Sin" && n > 0) return false;
    return true;
  });
}
