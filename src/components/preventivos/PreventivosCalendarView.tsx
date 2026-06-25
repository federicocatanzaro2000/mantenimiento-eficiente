import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PreventiveItem, STATUS_COLORS, MONTH_NAMES, effectiveStatus } from "@/lib/preventiveManual/types";
import { cn } from "@/lib/utils";

interface Props {
  items: PreventiveItem[];
  year: number;
  month: number;
  setYear: (y: number) => void;
  setMonth: (m: number) => void;
  todayISO: string;
  onDayClick: (dateISO: string) => void;
  onItemClick: (it: PreventiveItem) => void;
}

export function PreventivosCalendarView({ items, year, month, setYear, setMonth, todayISO, onDayClick, onItemClick }: Props) {
  const first = new Date(year, month - 1, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month, 0).getDate();

  const byDay: Record<number, PreventiveItem[]> = {};
  for (const it of items) {
    if (it.scheduled_year === year && it.scheduled_month === month) {
      (byDay[it.scheduled_day] ||= []).push(it);
    }
  }

  function prev() { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }
  function next() { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }

  const cells: { day?: number }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-3">
        <Button variant="outline" size="sm" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="font-semibold text-lg">{MONTH_NAMES[month - 1]} {year}</div>
        <Button variant="outline" size="sm" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-center font-semibold text-muted-foreground py-1">{d}</div>
        ))}
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} />;
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
          const events = byDay[c.day] ?? [];
          const isToday = iso === todayISO;
          return (
            <div key={i} className={cn("border rounded min-h-[90px] p-1 flex flex-col gap-0.5 hover:bg-muted/30", isToday && "border-primary border-2")}>
              <button onClick={() => onDayClick(iso)} className="text-xs font-semibold self-start text-left w-full">{c.day}</button>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {events.slice(0, 4).map((it) => {
                  const st = effectiveStatus(it, todayISO);
                  return (
                    <button key={it.id} onClick={() => onItemClick(it)} className={cn("text-[10px] px-1 py-0.5 rounded border truncate text-left", STATUS_COLORS[st])} title={`${it.equipment_code_snapshot} - ${it.task_name}${it.recurrence_parent_id ? " (recurrente)" : ""}`}>
                      {it.recurrence_parent_id && <span className="mr-0.5">↻</span>}
                      <span className="font-mono">{it.equipment_code_snapshot}</span> {it.task_name}
                    </button>
                  );
                })}
                {events.length > 4 && <div className="text-[10px] text-muted-foreground px-1">+{events.length - 4} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
