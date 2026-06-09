import { PreventiveItem, MONTH_NAMES, STATUS_COLORS, effectiveStatus } from "@/lib/preventiveManual/types";
import { cn } from "@/lib/utils";

interface Props {
  items: PreventiveItem[];
  year: number;
  todayISO: string;
  onCellClick: (equipmentCode: string, equipmentName: string, month: number, day?: number, existing?: PreventiveItem) => void;
}

interface GroupRow {
  code: string;
  name: string;
  freq: string;
  task: string;
  type: string;
  byMonth: Record<number, PreventiveItem[]>;
}

export function PreventivosGridView({ items, year, todayISO, onCellClick }: Props) {
  // Group by code+task+freq
  const map = new Map<string, GroupRow>();
  for (const it of items) {
    const k = `${it.equipment_code_snapshot}|${it.task_name}|${it.frequency_label ?? ""}`;
    let r = map.get(k);
    if (!r) {
      r = { code: it.equipment_code_snapshot, name: it.equipment_name_snapshot, freq: it.frequency_label ?? "", task: it.task_name, type: it.preventive_type, byMonth: {} };
      map.set(k, r);
    }
    (r.byMonth[it.scheduled_month] ||= []).push(it);
  }
  const rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code) || a.task.localeCompare(b.task));

  if (rows.length === 0) {
    return (
      <div className="border rounded p-8 text-center text-muted-foreground">
        No hay preventivos cargados para {year}.
      </div>
    );
  }

  return (
    <div className="border rounded overflow-auto max-h-[70vh]">
      <table className="text-xs border-collapse w-full">
        <thead className="sticky top-0 z-20 bg-secondary">
          <tr>
            <th className="sticky left-0 z-30 bg-secondary border px-2 py-2 text-left min-w-[80px]">Código</th>
            <th className="sticky left-[80px] z-30 bg-secondary border px-2 py-2 text-left min-w-[140px]">Equipo</th>
            <th className="border px-2 py-2 text-left min-w-[90px]">Frecuencia</th>
            <th className="border px-2 py-2 text-left min-w-[180px]">Tarea</th>
            <th className="border px-2 py-2 text-left min-w-[100px]">Tipo</th>
            {MONTH_NAMES.map((m, i) => (
              <th key={m} className="border px-2 py-2 text-center min-w-[70px]">{m.slice(0, 3)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ridx) => (
            <tr key={ridx} className="hover:bg-muted/30">
              <td className="sticky left-0 z-10 bg-background border px-2 py-1 font-mono">{r.code}</td>
              <td className="sticky left-[80px] z-10 bg-background border px-2 py-1">{r.name}</td>
              <td className="border px-2 py-1">{r.freq}</td>
              <td className="border px-2 py-1">{r.task}</td>
              <td className="border px-2 py-1">{r.type}</td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const ev = r.byMonth[m] ?? [];
                return (
                  <td key={m} className="border p-0.5 align-top">
                    {ev.length === 0 ? (
                      <button
                        className="w-full h-full min-h-[28px] text-muted-foreground/40 hover:bg-primary/5 text-xs"
                        onClick={() => onCellClick(r.code, r.name, m)}
                      >+</button>
                    ) : (
                      <div className="flex flex-wrap gap-0.5">
                        {ev.sort((a, b) => a.scheduled_day - b.scheduled_day).map((it) => {
                          const st = effectiveStatus(it, todayISO);
                          return (
                            <button
                              key={it.id}
                              onClick={() => onCellClick(r.code, r.name, m, it.scheduled_day, it)}
                              className={cn("px-1.5 py-0.5 rounded border text-xs font-semibold hover:scale-110 transition", STATUS_COLORS[st])}
                              title={`${it.task_name} - ${st}`}
                            >{it.scheduled_day}</button>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
