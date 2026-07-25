import { usePortal, computeVerification, type CheckStatus } from "@/lib/portal-cliente/onboarding-store";
import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";

const ICON: Record<CheckStatus, { Icon: typeof Circle; color: string }> = {
  ok: { Icon: CheckCircle2, color: "text-primary" },
  warn: { Icon: AlertTriangle, color: "text-state-pending" },
  fail: { Icon: XCircle, color: "text-destructive" },
  idle: { Icon: Circle, color: "text-muted-foreground" },
};

export function Step5Verification() {
  const state = usePortal();
  const checks = computeVerification(state);
  const anyFail = checks.some((c) => c.status === "fail");

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Verificación</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos son los cruces automáticos que hacemos con la información que subiste. SOZU no
          es notario ni RPP: estos resultados son insumo para el área legal, nunca aprobación
          automática.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card">
        {checks.map((c) => {
          const cfg = ICON[c.status];
          return (
            <div
              key={c.key}
              className="flex items-start gap-3 border-b border-border p-4 last:border-b-0"
            >
              <cfg.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.color}`} />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{c.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {anyFail && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            Uno o más cruces no coinciden. Tu caso se enviará al área legal de SOZU para
            revisión manual. Puedes continuar; podrías quedarte en Nivel 1 hasta resolver.
          </div>
        </div>
      )}
    </div>
  );
}
