import { usePortal } from "@/lib/portal-cliente/onboarding-store";
import { CheckCircle2, Info, Phone } from "lucide-react";
import { KeyValueRow } from "./KeyValueRow";
import { Button } from "@/components/ui/button";

export function Step6Linking() {
  const onb = usePortal((s) => s.onboarding);
  const approve = usePortal((s) => s.approveLevel);

  return (
    <div className="space-y-5">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-state-review/30 bg-state-review/10 px-3 py-1 text-xs font-medium text-state-review">
          <Info className="h-3 w-3" />
          En validación por el área legal de SOZU
        </div>
        <h2 className="mt-3 text-xl font-semibold">Tu solicitud está en validación</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recibirás actualizaciones por correo y en tu Portal del Cliente.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-4">
        <KeyValueRow
          label="Número de caso"
          value={<span className="num">{onb.caseId ?? "—"}</span>}
        />
        <KeyValueRow
          label="Ruteo interno"
          value={onb.routedDepartments.join(" · ") || "—"}
        />
        <KeyValueRow
          label="Contacto"
          value={
            <span className="inline-flex items-center gap-1 num">
              <Phone className="h-3 w-3" /> 33 2312 2610
            </span>
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LevelCard
          title="Nivel 1 · Administración / Cobranza"
          desc="Con ID + escritura + predial y cruces básicos OK. Acceso provisional: ver la propiedad, configurar y pagar mantenimiento, recibir notificaciones. No desbloquea actos de dominio."
          active={onb.level >= 1}
        />
        <LevelCard
          title="Nivel 2 · Titular reconocido"
          desc="Tras certificado RPP verificado + cruce de cadena de dominio + visto bueno del área legal. Desbloquea Patrimonio completo (reventa, refinanciamiento, actos de dominio)."
          active={onb.level >= 2}
        />
      </div>

      {onb.level === 0 && (
        <div className="rounded-md border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          Nivel 1 se otorga tras revisión inicial del área de Administración SOZU (típicamente
          en 24-48h hábiles). Puedes usar el panel <strong>DEMO</strong> para simular la
          aprobación.
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => approve(1)}>
              Simular aprobación Nivel 1
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelCard({
  title,
  desc,
  active,
}: {
  title: string;
  desc: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        active ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 font-semibold text-foreground">
        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
        {title}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
