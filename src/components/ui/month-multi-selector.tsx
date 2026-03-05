import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MONTH_NAMES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function getMonthFilterLabel(selectedMonths: string[]): string {
  if (selectedMonths.length === 0) return "Todos los meses";
  if (selectedMonths.length === 1) {
    const [y, m] = selectedMonths[0].split("-").map(Number);
    return `${MONTH_NAMES_FULL[m]} ${y}`;
  }
  return `${selectedMonths.length} meses`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}`;
}

export function buildDateRangesFromMonths(selectedMonths: string[]): { start: string; end: string }[] {
  return selectedMonths.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  });
}

interface MonthMultiSelectorProps {
  value: string[];
  onChange: (v: string[]) => void;
}

export function MonthMultiSelector({ value, onChange }: MonthMultiSelectorProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [displayYear, setDisplayYear] = useState(currentYear);

  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key]);
  };

  const years = [currentYear, currentYear - 1];

  return (
    <div className="p-3 min-w-[320px] space-y-3">
      {/* Year chips */}
      <div className="flex gap-2">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setDisplayYear(y)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              displayYear === y
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:bg-accent"
            )}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_NAMES.map((name, idx) => {
          const key = `${displayYear}-${idx}`;
          const isSelected = value.includes(key);
          const isFuture = displayYear === currentYear && idx > now.getMonth();
          return (
            <button
              key={key}
              disabled={isFuture}
              onClick={() => toggle(key)}
              className={cn(
                "px-2 py-1.5 rounded-md text-xs font-medium transition-colors border",
                isFuture && "opacity-30 cursor-not-allowed",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-accent"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onChange([`${currentYear}-${now.getMonth()}`])}
          className="text-[11px] text-primary hover:underline"
        >
          Mes actual
        </button>
        <button
          onClick={() => onChange([])}
          className="text-[11px] text-muted-foreground hover:underline"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
