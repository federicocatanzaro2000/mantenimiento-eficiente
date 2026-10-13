/** Cumplimiento preventivo = (en término + fuera de término) / (en término + fuera de término + vencidos). null si no hay base. */
export function calcularCumplimientoPreventivo(enTermino: number, fueraTermino: number, vencidos: number): number | null {
  const total = enTermino + fueraTermino + vencidos;
  if (total <= 0) return null;
  return ((enTermino + fueraTermino) / total) * 100;
}
