import { create } from "zustand";
import { Orden, Filtros, filtrosVacios } from "@/types/orden";
import {
  fetchOrdenes, insertOrden, updateOrdenDb, deleteOrdenDb, fetchProfilesMap,
} from "@/lib/ordenesApi";

interface State {
  ordenes: Orden[];
  profilesMap: Record<string, string>;
  loaded: boolean;
  loading: boolean;
  filtros: Filtros;
  loadAll: () => Promise<void>;
  addOrden: (o: Orden) => Promise<Orden>;
  updateOrden: (id: string, o: Orden) => Promise<Orden>;
  deleteOrden: (id: string) => Promise<void>;
  setFiltros: (f: Filtros) => void;
  resetFiltros: () => void;
  nextNroOrden: () => number;
  nombreDe: (uid?: string | null) => string;
}

export const useOrdenesStore = create<State>()((set, get) => ({
  ordenes: [],
  profilesMap: {},
  loaded: false,
  loading: false,
  filtros: filtrosVacios,

  loadAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [ordenes, profilesMap] = await Promise.all([fetchOrdenes(), fetchProfilesMap()]);
      set({ ordenes, profilesMap, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addOrden: async (o) => {
    const saved = await insertOrden(o);
    set({ ordenes: [saved, ...get().ordenes] });
    return saved;
  },

  updateOrden: async (id, o) => {
    const saved = await updateOrdenDb(id, o);
    set({ ordenes: get().ordenes.map((x) => x.id === id ? saved : x) });
    return saved;
  },

  deleteOrden: async (id) => {
    await deleteOrdenDb(id);
    set({ ordenes: get().ordenes.filter((x) => x.id !== id) });
  },

  setFiltros: (f) => set({ filtros: f }),
  resetFiltros: () => set({ filtros: filtrosVacios }),

  nextNroOrden: () => {
    const nums = get().ordenes.map((o) => Number(o.nroOrden) || 0);
    return (nums.length ? Math.max(...nums) : 1000) + 1;
  },

  nombreDe: (uid) => (uid ? (get().profilesMap[uid] || "—") : "—"),
}));
