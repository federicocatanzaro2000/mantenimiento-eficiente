import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Orden, Filtros, filtrosVacios } from "@/types/orden";
import { ordenesMock } from "@/data/mockOrdenes";

interface State {
  ordenes: Orden[];
  filtros: Filtros;
  addOrden: (o: Orden) => void;
  updateOrden: (id: string, o: Partial<Orden>) => void;
  deleteOrden: (id: string) => void;
  setFiltros: (f: Filtros) => void;
  resetFiltros: () => void;
  nextNroOrden: () => number;
}

export const useOrdenesStore = create<State>()(
  persist(
    (set, get) => ({
      ordenes: ordenesMock,
      filtros: filtrosVacios,
      addOrden: (o) => set({ ordenes: [...get().ordenes, o] }),
      updateOrden: (id, patch) =>
        set({
          ordenes: get().ordenes.map((o) =>
            o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : o
          ),
        }),
      deleteOrden: (id) => set({ ordenes: get().ordenes.filter((o) => o.id !== id) }),
      setFiltros: (f) => set({ filtros: f }),
      resetFiltros: () => set({ filtros: filtrosVacios }),
      nextNroOrden: () => {
        const nums = get().ordenes.map((o) => Number(o.nroOrden) || 0);
        return (nums.length ? Math.max(...nums) : 1000) + 1;
      },
    }),
    { name: "ordenes-mantenimiento-v1" }
  )
);
