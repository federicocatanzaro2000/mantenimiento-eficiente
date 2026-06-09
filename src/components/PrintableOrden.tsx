import { Orden } from "@/types/orden";
import logo from "@/assets/logo-incalfood.png";

const dash = (v: any) => {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string" && v.trim() === "") return "-";
  return String(v);
};

const yn = (v: boolean) => (v ? "SÍ" : "NO");

function F({ label, value, span = 1 }: { label: string; value: React.ReactNode; span?: number }) {
  return (
    <div className={`po-field po-span-${span}`}>
      <div className="po-label">{label}</div>
      <div className="po-value">{value}</div>
    </div>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="po-section-title">
      <span className="po-section-n">{n}</span> {title}
    </div>
  );
}

export function PrintableOrden({ orden }: { orden: Orden }) {
  const now = new Date();
  const printedAt =
    now.toLocaleDateString("es-AR") + " " + now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const mats = orden.materialesUtilizados ?? [];

  return (
    <div className="print-only po-root">
      {/* Encabezado */}
      <header className="po-header">
        <img src={logo} alt="Incalfood" className="po-logo" />
        <div className="po-title-wrap">
          <h1 className="po-title">ORDEN DE MANTENIMIENTO / OIT</h1>
          <div className="po-subtitle">Sistema Mantenimiento Eficiente — Incalfood</div>
        </div>
        <div className="po-header-meta">
          <div><b>N°:</b> {dash(orden.nroOrden)}</div>
          <div><b>Fecha:</b> {dash(orden.fechaCreacion)}</div>
          <div><b>Estado:</b> {dash(orden.estado)}</div>
          <div><b>Prioridad:</b> {dash(orden.prioridad)}</div>
          <div><b>Tipo:</b> {dash(orden.tipoOrden)}</div>
          <div><b>Aprobado:</b> {yn(orden.aprobado)}</div>
        </div>
      </header>

      <div className="po-sections">
        {/* 1. Datos principales */}
        <section className="po-section po-s-datos">
          <SectionTitle n={1} title="Datos principales" />
          <div className="po-grid po-grid-4">
            <F label="N° de orden" value={dash(orden.nroOrden)} />
            <F label="Fecha de creación" value={dash(orden.fechaCreacion)} />
            <F label="Tipo de orden" value={dash(orden.tipoOrden)} />
            <F label="Aprobado" value={yn(orden.aprobado)} />
            <F label="Solicitante" value={dash(orden.solicitante)} />
            <F label="Técnico responsable" value={dash(orden.tecnicoResponsable)} />
            <F label="Sector" value={dash(orden.sector)} />
            <F label="Estado" value={dash(orden.estado)} />
          </div>
        </section>

        {/* 2. Planificación y ejecución */}
        <section className="po-section po-s-plan">
          <SectionTitle n={2} title="Planificación y ejecución" />
          <div className="po-grid po-grid-5">
            <F label="Fecha de inicio" value={dash(orden.fechaInicio)} />
            <F label="Fecha de finalización" value={dash(orden.fechaFinalizacion)} />
            <F label="Fecha límite" value={dash(orden.fechaLimiteRealizacion)} />
            <F label="Horas presup." value={dash(orden.horasPresupuestadas)} />
            <F label="Horas reales" value={dash(orden.horasReales)} />
          </div>
          <div className="po-grid po-grid-2 po-grid-tall">
            <F label="Descripción del problema" value={<div className="po-text po-text-tall">{dash(orden.descripcionProblema)}</div>} />
            <F label="Trabajo solicitado" value={<div className="po-text po-text-tall">{dash(orden.trabajoSolicitado)}</div>} />
          </div>
        </section>

        {/* 3. Equipo y documentación */}
        <section className="po-section po-s-equipo">
          <SectionTitle n={3} title="Equipo y documentación" />
          <div className="po-grid po-grid-3">
            <F label="Código de documento" value={dash(orden.codigoDocumento)} />
            <F label="Código de equipo" value={dash(orden.codigoEquipo)} />
            <F label="Nombre de equipo" value={dash(orden.nombreEquipo)} />
          </div>
        </section>

        {/* 4. Recepción, limpieza y herramientas */}
        <section className="po-section po-s-recep">
          <SectionTitle n={4} title="Recepción, limpieza y herramientas" />
          <div className="po-grid po-grid-3">
            <F label="Estado de recepción del equipo" value={dash(orden.estadoRecepcionEquipo)} />
            <F label="Sector limpio y ordenado" value={yn(orden.sectorLimpioOrdenado)} />
            <F label="Herramientas limpias y ordenadas" value={yn(orden.herramientasLimpiasOrdenadas)} />
          </div>
          <div className="po-grid po-grid-1">
            <F label="Observaciones" value={<div className="po-text po-text-mid">{dash(orden.observaciones)}</div>} />
          </div>
        </section>

        {/* 5. Materiales utilizados */}
        <section className="po-section po-s-mat">
          <SectionTitle n={5} title="Materiales utilizados" />
          {mats.length === 0 ? (
            <div className="po-empty">Sin materiales utilizados</div>
          ) : (
            <table className="po-table">
              <thead>
                <tr>
                  <th style={{ width: "15%" }}>Cantidad</th>
                  <th>Descripción</th>
                  <th style={{ width: "25%" }}>Código</th>
                </tr>
              </thead>
              <tbody>
                {mats.map((m) => (
                  <tr key={m.id}>
                    <td>{dash(m.cantidad)}</td>
                    <td>{dash(m.descripcion)}</td>
                    <td>{dash(m.codigo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 6. Calidad y aprobaciones */}
        <section className="po-section po-s-calidad">
          <SectionTitle n={6} title="Calidad y aprobaciones" />
          <div className="po-grid po-grid-2">
            <F label="Control / Liberación Calidad" value={yn(orden.controlLiberacionCalidad)} />
            <F label="Resp. Control de Calidad" value={dash(orden.responsableControlCalidad)} />
          </div>
          <div className="po-signs">
            <div className="po-sign">
              <div className="po-sign-label">Elaboró</div>
              <div className="po-sign-name">{dash(orden.elaboro)}</div>
              <div className="po-sign-line">Firma</div>
            </div>
            <div className="po-sign">
              <div className="po-sign-label">Revisó</div>
              <div className="po-sign-name">{dash(orden.reviso)}</div>
              <div className="po-sign-line">Firma</div>
            </div>
            <div className="po-sign">
              <div className="po-sign-label">Aprobó</div>
              <div className="po-sign-name">{dash(orden.aprobo)}</div>
              <div className="po-sign-line">Firma</div>
            </div>
          </div>
        </section>
      </div>

      <footer className="po-footer">
        <span>Documento generado desde el sistema Mantenimiento Eficiente</span>
        <span>Impreso: {printedAt}</span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  );
}
