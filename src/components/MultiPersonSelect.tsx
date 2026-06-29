import { useState } from "react";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface MPOption {
  value: string;
  label: string;
  inactive?: boolean;
}

interface Props {
  values: string[];
  onChange: (v: string[]) => void;
  options: MPOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
}

export function MultiPersonSelect({
  values, onChange, options,
  placeholder = "Agregar...",
  emptyText = "Sin resultados",
  disabled = false,
  allowFreeText = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState("");

  const add = (v: string) => {
    const t = v.trim();
    if (!t) return;
    if (values.some((x) => x.trim().toLowerCase() === t.toLowerCase())) return;
    onChange([...values, t]);
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  // Build full option list ensuring current values appear (as inactive snapshot when not in catalog)
  const merged: MPOption[] = (() => {
    const seen = new Set(options.map((o) => o.value.toLowerCase()));
    const extra = values
      .filter((v) => !seen.has(v.toLowerCase()))
      .map<MPOption>((v) => ({ value: v, label: v, inactive: true }));
    return [...options, ...extra];
  })();

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground italic py-1">Sin técnicos asignados</span>
        )}
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1 font-normal">
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(v)}
                className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Quitar ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>

      {!disabled && (
        <div className="flex gap-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="flex-1 justify-between font-normal h-9"
              >
                <span className="text-muted-foreground">{placeholder}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command
                filter={(val, search) => {
                  const opt = merged.find((o) => o.value === val);
                  const hay = (opt?.label ?? val).toLowerCase();
                  return hay.includes(search.toLowerCase()) ? 1 : 0;
                }}
              >
                <CommandInput placeholder="Buscar..." value={free} onValueChange={setFree} />
                <CommandList>
                  <CommandEmpty>
                    {allowFreeText && free.trim() ? (
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                        onClick={() => { add(free); setFree(""); setOpen(false); }}
                      >
                        <Plus className="inline h-3 w-3 mr-1" /> Agregar "{free.trim()}"
                      </button>
                    ) : emptyText}
                  </CommandEmpty>
                  <CommandGroup>
                    {merged.map((o) => {
                      const checked = values.some((v) => v.toLowerCase() === o.value.toLowerCase());
                      return (
                        <CommandItem
                          key={o.value}
                          value={o.value}
                          onSelect={(v) => {
                            if (checked) remove(o.value);
                            else add(v);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                          <span className={cn("truncate", o.inactive && "text-muted-foreground italic")}>
                            {o.label}{o.inactive ? " (inactivo)" : ""}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
