import { usePortal, getPropertyById } from "@/lib/portal-cliente/onboarding-store";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, CheckCircle2, Lock } from "lucide-react";
import { KeyValueRow } from "./KeyValueRow";

export function Step7Transfer() {
  const state = usePortal();
  const property = getPropertyById(state, state.onboarding.unitId);
  const level = state.onboarding.level;
  const transfer = state.transferOwnership;
  const user = state.auth.user;

  if (level < 2) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold">Transferencia del registro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Al aprobar Nivel 2, transferimos el registro de la unidad del dueño anterior a ti
            y finalizamos su obligación de mantenimiento a la fecha de transferencia.
          </p>
        </header>
        <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            Este paso se desbloquea cuando el área legal apruebe el Nivel 2. Puedes forzar la
            aprobación desde el panel <strong>DEMO</strong> para probar el flujo.
          </div>
        </div>
      </div>
    );
  }

  const alreadyTransferred = property && user && property.currentOwnerId === user.id;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Transferencia del registro</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nivel 2 aprobado. Ejecuta la transferencia para vincular la unidad a tu Patrimonio.
        </p>
      </header>

      {property && (
        <div className="rounded-lg border border-border bg-card p-4">
          <KeyValueRow label="Unidad" value={`${property.project} · ${property.unit}`} />
          <KeyValueRow
            label="Folio real"
            value={<span className="num">{property.folioReal}</span>}
          />
          <KeyValueRow
            label="Dueño anterior"
            value={<span className="num">{property.originalOwnerId}</span>}
          />
          <KeyValueRow
            label="Nuevo dueño"
            value={<span className="num">{user?.id ?? "—"}</span>}
          />
        </div>
      )}

      {!alreadyTransferred ? (
        <Button
          onClick={() => property && user && transfer(property.id, user.id)}
          disabled={!property || !user}
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Ejecutar transferencia
        </Button>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Transferencia completada. La unidad aparece ahora en tu Patrimonio.
        </div>
      )}
      {/* SWAP POINT: transferencia de titularidad en el modelo de datos + baja del dueño anterior. */}
    </div>
  );
}
