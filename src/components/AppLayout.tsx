import { NavLink, useLocation } from "react-router-dom";
import { ClipboardList, FilePlus, Filter, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-incalfood.png";

const tabs = [
  { to: "/", label: "Listado", icon: ClipboardList, end: true },
  { to: "/orden/nueva", label: "Nueva Orden", icon: FilePlus },
  { to: "/filtros", label: "Filtros", icon: Filter },
  { to: "/resultados", label: "Resultados", icon: Table2 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[hsl(var(--header-bg))] text-[hsl(var(--header-fg))] shadow">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-3">
          <Wrench className="h-6 w-6" />
          <h1 className="text-lg font-semibold tracking-tight">Órdenes de Mantenimiento</h1>
          <span className="ml-auto text-xs opacity-70 hidden sm:block">Sistema de gestión industrial</span>
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
                end={t.end}
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
