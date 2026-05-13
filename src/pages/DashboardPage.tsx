import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useOrdenesStore } from "@/store/ordenesStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { EstadoOrden, TipoOrden } from "@/types/orden";

const ESTADOS: EstadoOrden[] = ["Pendiente", "En proceso", "Cumplido"];
const TIPOS: TipoOrden[] = ["Preventivo", "Correctivo", "Edilicio", "Limpieza"];

const COLORS_ESTADO: Record<string, string> = {
  "Pendiente": "hsl(45 93% 47%)",
  "En proceso": "hsl(217 91% 60%)",
  "Cumplido": "hsl(142 71% 45%)",
};
const COLORS_TIPO = ["hsl(217 91% 60%)", "hsl(0 84% 60%)", "hsl(262 83% 58%)", "hsl(142 71% 45%)"];

const inRange = (date: string, from: string, to: string) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

export default function DashboardPage() {
  const ordenes = useOrdenesStore((s) => s.ordenes);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [estadoDesde, setEstadoDesde] = useState(monthAgo);
  const [estadoHasta, setEstadoHasta] = useState(today);
  const [tipoDesde, setTipoDesde] = useState(monthAgo);
  const [tipoHasta, setTipoHasta] = useState(today);

  const dataEstado = useMemo(() => {
    const filtered = ordenes.filter((o) => inRange(o.fechaCreacion, estadoDesde, estadoHasta));
    return ESTADOS.map((estado) => ({
      estado,
      cantidad: filtered.filter((o) => o.estado === estado).length,
    }));
  }, [ordenes, estadoDesde, estadoHasta]);

  const totalEstado = dataEstado.reduce((s, d) => s + d.cantidad, 0);

  const dataTipo = useMemo(() => {
    const filtered = ordenes.filter((o) => inRange(o.fechaCreacion, tipoDesde, tipoHasta));
    return TIPOS.map((tipo) => ({
      tipo,
      cantidad: filtered.filter((o) => o.tipoOrden === tipo).length,
    }));
  }, [ordenes, tipoDesde, tipoHasta]);

  const totalTipo = dataTipo.reduce((s, d) => s + d.cantidad, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Resumen de órdenes por estado y por tipo.</p>
        </div>

        {/* Estados */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <CardTitle className="text-lg">Órdenes por Estado</CardTitle>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={estadoDesde} onChange={(e) => setEstadoDesde(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={estadoHasta} onChange={(e) => setEstadoHasta(e.target.value)} className="h-9 w-40" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {dataEstado.map((d) => (
                <div key={d.estado} className="rounded-md border p-4 flex items-center justify-between" style={{ borderLeft: `4px solid ${COLORS_ESTADO[d.estado]}` }}>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{d.estado}</div>
                    <div className="text-3xl font-bold">{d.cantidad}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {totalEstado ? Math.round((d.cantidad / totalEstado) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataEstado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="estado" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {dataEstado.map((d) => (
                      <Cell key={d.estado} fill={COLORS_ESTADO[d.estado]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground mt-2">Total en el rango: <strong>{totalEstado}</strong> órdenes</div>
          </CardContent>
        </Card>

        {/* Tipos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <CardTitle className="text-lg">Órdenes por Tipo</CardTitle>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={tipoDesde} onChange={(e) => setTipoDesde(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={tipoHasta} onChange={(e) => setTipoHasta(e.target.value)} className="h-9 w-40" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataTipo} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="tipo" stroke="hsl(var(--muted-foreground))" fontSize={12} width={90} />
                    <Tooltip />
                    <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
                      {dataTipo.map((_, i) => (
                        <Cell key={i} fill={COLORS_TIPO[i % COLORS_TIPO.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataTipo.filter((d) => d.cantidad > 0)} dataKey="cantidad" nameKey="tipo" outerRadius={100} label>
                      {dataTipo.map((_, i) => (
                        <Cell key={i} fill={COLORS_TIPO[i % COLORS_TIPO.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <table className="w-full text-sm mt-4 border">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 border-b">Tipo</th>
                  <th className="text-right p-2 border-b w-32">Cantidad</th>
                  <th className="text-right p-2 border-b w-32">%</th>
                </tr>
              </thead>
              <tbody>
                {dataTipo.map((d, i) => (
                  <tr key={d.tipo} className={i % 2 ? "bg-muted/30" : ""}>
                    <td className="p-2 border-b">{d.tipo}</td>
                    <td className="p-2 border-b text-right font-medium">{d.cantidad}</td>
                    <td className="p-2 border-b text-right">{totalTipo ? Math.round((d.cantidad / totalTipo) * 100) : 0}%</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-muted/50">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right">{totalTipo}</td>
                  <td className="p-2 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
