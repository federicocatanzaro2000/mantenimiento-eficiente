import { AppRole } from "@/hooks/useAuth";

export type SeccionNro = 1 | 2 | 3 | 4 | 5 | 6;

export function canEditSection(roles: AppRole[], seccion: SeccionNro): boolean {
  if (roles.includes("supervisor")) return true;
  if (roles.includes("calidad") && seccion === 6) return true;
  if (roles.includes("operario") && (seccion === 3 || seccion === 4)) return true;
  if (roles.includes("panol") && seccion === 5) return true;
  return false;
}

export function canEditAny(roles: AppRole[]): boolean {
  return (["supervisor", "calidad", "operario", "panol"] as AppRole[]).some((r) => roles.includes(r));
}

export function canCreateOrden(roles: AppRole[]): boolean {
  return roles.includes("supervisor");
}

export function canDeleteOrden(roles: AppRole[]): boolean {
  return roles.includes("supervisor");
}

export function isAdminUsuarios(roles: AppRole[]): boolean {
  return roles.includes("admin_usuarios");
}

export const ROLE_LABELS: Record<AppRole, string> = {
  supervisor: "Supervisor",
  calidad: "Calidad",
  operario: "Operario",
  panol: "Pañol",
  admin_usuarios: "Administrador de Usuarios",
};
