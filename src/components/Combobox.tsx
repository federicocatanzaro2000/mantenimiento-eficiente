import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption { value: string; label: string; keywords?: string; }

interface Props {
  options: ComboboxOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowFreeSnapshot?: boolean; // if value is not in options, still display it (historical)
}

export function Combobox({ options, value, onChange, placeholder = "Seleccionar...", emptyText = "Sin resultados", disabled, className, allowFreeSnapshot }: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? (allowFreeSnapshot && value ? value : "");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
          className={cn("w-full justify-between font-normal", !display && "text-muted-foreground", className)}>
          <span className="truncate">{display || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
        <Command filter={(val, search) => {
          const opt = options.find((o) => o.value === val);
          const hay = (opt ? (opt.label + " " + (opt.keywords ?? "")) : val).toLowerCase();
          return hay.includes(search.toLowerCase()) ? 1 : 0;
        }}>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.value} onSelect={(v) => { onChange(v === value ? "" : v); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
