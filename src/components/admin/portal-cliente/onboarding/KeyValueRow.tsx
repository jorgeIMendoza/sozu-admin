import { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  mono?: boolean;
  hint?: string;
}

export function KeyValueRow({ label, value, mono, hint }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      <span
        className={`text-right text-sm font-semibold text-foreground ${mono ? "num" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
