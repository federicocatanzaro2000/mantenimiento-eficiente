import { Filtros, filtrosVacios, EstadoOrden, Prioridad } from "@/types/orden";

// Mapping between Filtros keys and URL query param names
const MAP: Record<keyof Filtros, string> = {
  fechaCreacionDesde: "created_from",
  fechaCreacionHasta: "created_to",
  fechaInicioDesde: "start_from",
  fechaInicioHasta: "start_to",
  fechaFinDesde: "end_from",
  fechaFinHasta: "end_to",
  fechaLimiteDesde: "due_from",
  fechaLimiteHasta: "due_to",
  nroOrden: "order_number",
  sector: "sector",
  tecnicoResponsable: "technician",
  solicitante: "requester",
  tipoOrden: "type",
  estado: "status",
  prioridad: "priority",
  aprobado: "approved",
  codigoDocumento: "document_code",
  codigoEquipo: "equipment_code",
  nombreEquipo: "equipment_name",
  estadoRecepcionEquipo: "reception_status",
  horasPresupMin: "budget_hours_min",
  horasPresupMax: "budget_hours_max",
  horasRealesMin: "real_hours_min",
  horasRealesMax: "real_hours_max",
  sectorLimpio: "clean_sector",
  herramientasLimpias: "tools_ordered",
  controlCalidad: "quality_control",
  responsableControlCalidad: "quality_responsible",
  elaboro: "created_by_person",
  reviso: "reviewed_by_person",
  aprobo: "approved_by_person",
  lineStopped: "line_stopped",
  lineStoppedHorasMin: "line_stopped_hours_min",
  lineStoppedHorasMax: "line_stopped_hours_max",
  attachments: "attachments",
  projectEquipo: "project_equipment",
};

const ARRAY_KEYS: (keyof Filtros)[] = ["tipoOrden", "estado", "prioridad"];
const TRISTATE_DEFAULT_TODOS: (keyof Filtros)[] = [
  "aprobado", "estadoRecepcionEquipo", "sectorLimpio",
  "herramientasLimpias", "controlCalidad", "lineStopped", "attachments", "projectEquipo",
];

function isDefault(key: keyof Filtros, value: any): boolean {
  if (ARRAY_KEYS.includes(key)) return !value || (Array.isArray(value) && value.length === 0);
  if (TRISTATE_DEFAULT_TODOS.includes(key)) return value === "Todos" || value === "" || value == null;
  return value === "" || value == null;
}

export function filtersToParams(f: Filtros): URLSearchParams {
  const sp = new URLSearchParams();
  (Object.keys(MAP) as (keyof Filtros)[]).forEach((k) => {
    const v = (f as any)[k];
    if (isDefault(k, v)) return;
    if (ARRAY_KEYS.includes(k) && Array.isArray(v)) {
      sp.set(MAP[k], v.join(","));
    } else {
      sp.set(MAP[k], String(v));
    }
  });
  return sp;
}

export function paramsToFilters(sp: URLSearchParams): Filtros {
  const out: Filtros = { ...filtrosVacios };
  (Object.keys(MAP) as (keyof Filtros)[]).forEach((k) => {
    const raw = sp.get(MAP[k]);
    if (raw == null) return;
    if (ARRAY_KEYS.includes(k)) {
      const arr = raw.split(",").map((x) => x.trim()).filter(Boolean);
      if (k === "estado") (out as any)[k] = arr as EstadoOrden[];
      else if (k === "prioridad") (out as any)[k] = arr as Prioridad[];
      else (out as any)[k] = arr;
    } else {
      (out as any)[k] = raw;
    }
  });
  return out;
}

export function hasActiveFilters(f: Filtros): boolean {
  return (Object.keys(MAP) as (keyof Filtros)[]).some((k) => !isDefault(k, (f as any)[k]));
}
