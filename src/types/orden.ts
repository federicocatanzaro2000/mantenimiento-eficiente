export type TipoOrden = string;
export type EstadoOrden = "Cumplido" | "Pendiente" | "En proceso";
export type Prioridad = "Alta" | "Media" | "Baja";
export type RecepcionEquipo = "APTO" | "NO APTO" | "";

export interface Material {
  id: string;
  cantidad: number | "";
  descripcion: string;
  codigo: string;
}

export interface Orden {
  id: string;
  nroOrden: number | "";
  fechaCreacion: string;
  fechaInicio: string;
  fechaFinalizacion: string;
  fechaLimiteRealizacion: string;
  tecnicoResponsable: string;
  sector: string;
  tipoOrden: TipoOrden | "";
  aprobado: boolean;
  estado: EstadoOrden | "";
  prioridad: Prioridad | "";
  horasPresupuestadas: number | "";
  horasReales: number | "";
  descripcionProblema: string;
  codigoDocumento: string;
  codigoEquipo: string;
  nombreEquipo: string;
  solicitante: string;
  trabajoSolicitado: string;
  estadoRecepcionEquipo: RecepcionEquipo;
  observaciones: string;
  sectorLimpioOrdenado: boolean;
  herramientasLimpiasOrdenadas: boolean;
  materialesUtilizados: Material[];
  controlLiberacionCalidad: boolean;
  responsableControlCalidad: string;
  elaboro: string;
  reviso: string;
  aprobo: string;
  lineStopped: boolean | null;
  lineStoppedHours: number | "";
  attachmentsCount?: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface Filtros {
  fechaCreacionDesde: string;
  fechaCreacionHasta: string;
  fechaInicioDesde: string;
  fechaInicioHasta: string;
  tecnicoResponsable: string;
  sector: string;
  tipoOrden: TipoOrden[];
  fechaFinDesde: string;
  fechaFinHasta: string;
  aprobado: "Todos" | "Aprobadas" | "No aprobadas";
  estado: EstadoOrden[];
  prioridad: Prioridad[];
  horasPresupMin: string;
  horasPresupMax: string;
  horasRealesMin: string;
  horasRealesMax: string;
  codigoDocumento: string;
  codigoEquipo: string;
  nombreEquipo: string;
  nroOrden: string;
  solicitante: string;
  fechaLimiteDesde: string;
  fechaLimiteHasta: string;
  estadoRecepcionEquipo: "Todos" | "APTO" | "NO APTO";
  sectorLimpio: "Todos" | "Limpio" | "No limpio";
  herramientasLimpias: "Todos" | "Ordenado" | "No ordenado";
  controlCalidad: "Todos" | "SI" | "NO";
  responsableControlCalidad: string;
  elaboro: string;
  reviso: string;
  aprobo: string;
  lineStopped: "Todos" | "Si" | "No";
  lineStoppedHorasMin: string;
  lineStoppedHorasMax: string;
  attachments: "Todos" | "Con" | "Sin";
}

export const filtrosVacios: Filtros = {
  fechaCreacionDesde: "", fechaCreacionHasta: "",
  fechaInicioDesde: "", fechaInicioHasta: "",
  tecnicoResponsable: "", sector: "",
  tipoOrden: [],
  fechaFinDesde: "", fechaFinHasta: "",
  aprobado: "Todos",
  estado: [], prioridad: [],
  horasPresupMin: "", horasPresupMax: "",
  horasRealesMin: "", horasRealesMax: "",
  codigoDocumento: "", codigoEquipo: "", nombreEquipo: "",
  nroOrden: "", solicitante: "",
  fechaLimiteDesde: "", fechaLimiteHasta: "",
  estadoRecepcionEquipo: "Todos",
  sectorLimpio: "Todos",
  herramientasLimpias: "Todos",
  controlCalidad: "Todos",
  responsableControlCalidad: "", elaboro: "", reviso: "", aprobo: "",
  lineStopped: "Todos", lineStoppedHorasMin: "", lineStoppedHorasMax: "",
  attachments: "Todos",
};
