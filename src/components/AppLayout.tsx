import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, FilePlus, Filter, Table2, BarChart3, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-incalfood.png";
import { useAuth } from "@/hooks/useAuth";
import { isAdminUsuarios, ROLE_LABELS, canCreateOrden } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, roles, nombre, signOut } = useAuth();

  const tabs = [
    { to: "/", label: "Listado", icon: ClipboardList, end: true, show: true },
    { to: "/orden/nueva", label: "Nueva Orden", icon: FilePlus, show: canCreateOrden(roles) },
    { to: "/filtros", label: "Filtros", icon: Filter, show: true },
    { to: "/resultados", label: "Resultados", icon: Table2, show: true },
    { to: "/dashboard", label: "Dashboard", icon: BarChart3, show: true },
    { to: "/usuarios", label: "Usuarios", icon: Users, show: isAdminUsuarios(roles) },
  ].filter((t) => t.show);

  const rolesTxt = roles.map((r) => ROLE_LABELS[r]).join(" · ") || "Sin roles asignados";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[hsl(var(--header-bg))] text-[hsl(var(--header-fg))] shadow no-print">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-3">
          <img src={logo} alt="INCALFOOD" className="h-10 w-auto bg-white rounded p-1" />
          <h1 className="text-lg font-semibold tracking-tight">Órdenes de Mantenimiento</h1>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="text-right text-xs leading-tight hidden sm:block">
                <div className="font-medium">{nombre || user.email}</div>
                <div className="opacity-70">{rolesTxt}</div>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate("/login"); }} className="text-white hover:bg-white/10 gap-1">
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
        <nav className="max-w-[1600px] mx-auto px-2 flex flex-wrap gap-1 border-t border-white/10">
          {tabs.map((t) => {
            const active =
              t.end ? loc.pathname === "/" :
              t.to === "/orden/nueva" ? loc.pathname.startsWith("/orden") :
              loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end as any}
                className={cn(
                  "px-3 py-2 text-sm flex items-center gap-2 border-b-2 transition-colors",
                  active
                    ? "border-white text-white font-medium"
                    : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="max-w-[1600px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
