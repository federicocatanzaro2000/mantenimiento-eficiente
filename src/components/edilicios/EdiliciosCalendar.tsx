import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Orden } from "@/types/orden";
import { cn } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/preventiveManual/types";
import { EDILICIO_STATUS_COLORS, edilicioEstado, ediScheduledDate } from "@/lib/edilicios/status";

interface Props {
  items: Orden[];
  year: number;
  month: number;
  mode: "mes" | "semana";
  weekStartISO: string;
  todayISO: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onDayClick: (dateISO: string) => void;
  onItemClick: (o: Orden) => void;
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EventChip({ o, todayISO, onClick }: { o: Orden; todayISO: string; onClick: () => void }) {
  const st = edilicioEstado(o, todayISO);
  const lugar = o.codigoEquipo || o.nombreEquipo || o.sector || "";
  const desc = o.trabajoSolicitado || o.descripcionProblema || "";
  return (
    <button
      onClick={onClick}
      title={`OIT ${o.nroOrden} · ${lugar} · ${desc}`}
      className={cn("text-[10px] px-1 py-0.5 rounded border text-left w-full overflow-hidden", EDILICIO_STATUS_COLORS[st])}
    >
      <div className="font-semibold truncate">OIT {o.nroOrden}{st === "Vencida" ? " ⚠" : ""}</div>
      {lugar && <div className="truncate opacity-90">{lugar}</div>}
      {desc && <div className="truncate opacity-80">{desc}</div>}
    </button>
  );
}

export function EdiliciosCalendar({ items, year, month, mode, weekStartISO, todayISO, onPrev, onNext, onToday, onDayClick, onItemClick }: Props) {
  const byDay: Record<string, Orden[]> = {};
  for (const o of items) {
    const d = ediScheduledDate(o);
    if (!d) continue;
    (byDay[d] ||= []).push(o);
  }

  let days: (string | null)[] = [];
  if (mode === "mes") {
    const first = new Date(year, month - 1, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  } else {
    const [y, m, d] = weekStartISO.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    for (let i = 0; i < 7; i++) {
      const dd = new Date(base);
      dd.setDate(base.getDate() + i);
      days.push(isoOf(dd));
    }
  }

  const label = mode === "mes"
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : `Semana del ${weekStartISO.split("-").reverse().join("/")}`;

  const maxPerDay = mode === "mes" ? 3 : 12;

  return (
    <div className="border rounded p-3 overflow-x-auto">
      <div className="flex items-center justify-between gap-2 mb-3 min-w-[640px]">
        <Button variant="outline" size="sm" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-2">
          <div className="font-semibold text-lg capitalize">{label}</div>
          <Button variant="ghost" size="sm" onClick={onToday}>Hoy</Button>
        </div>
        <Button variant="outline" size="sm" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs min-w-[640px]">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-center font-semibold text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const events = byDay[iso] ?? [];
          const isToday = iso === todayISO;
          return (
            <div key={i} className={cn("border rounded p-1 flex flex-col gap-0.5 hover:bg-muted/30", mode === "mes" ? "min-h-[110px]" : "min-h-[260px]", isToday && "border-primary border-2")}>
              <button onClick={() => onDayClick(iso)} className="text-xs font-semibold self-start text-left w-full">
                {Number(iso.slice(8, 10))}
              </button>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {events.slice(0, maxPerDay).map((o) => (
                  <EventChip key={o.id} o={o} todayISO={todayISO} onClick={() => onItemClick(o)} />
                ))}
                {events.length > maxPerDay && (
                  <button onClick={() => onDayClick(iso)} className="text-[10px] text-primary underline px-1 text-left">
                    + {events.length - maxPerDay} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
