import { Landmark, Hash, User, CreditCard, Image as ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Section, KV } from "./_shared";
import { useAgenteCuentaBancaria } from "@/hooks/useAgenteCuentaBancaria";

/**
 * Sección "Cuenta bancaria del agente": muestra la cuenta que el comisionista
 * externo dio de alta para recibir su comisión/honorarios (Banco, Número de
 * cuenta, Titular, CLABE y la evidencia/carátula bancaria).
 *
 * Se usa en los drawers de "Comisiones externas por aprobar" y "Pagos a externos
 * por ejecutar" de la Bandeja de Ejecución.
 */
export function CuentaBancariaAgenteSection({ email }: { email: string | null | undefined }) {
  const { data, isLoading } = useAgenteCuentaBancaria(email);

  return (
    <Section title="Cuenta bancaria del agente">
      {isLoading ? (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando cuenta bancaria…
        </p>
      ) : !data ? (
        <p className="text-xs text-muted-foreground">
          El agente no tiene una cuenta bancaria registrada.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <KV icon={Landmark} label="Banco" value={data.banco || "—"} />
            <KV icon={Hash} label="Número de cuenta" value={data.numero_cuenta || "—"} mono />
            <KV icon={User} label="Titular de la cuenta" value={data.titular || "—"} />
            <KV icon={CreditCard} label="CLABE" value={data.clabe || "—"} mono />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Evidencia (carátula bancaria)
              </p>
              <Badge
                variant="outline"
                className={
                  data.verificada
                    ? "text-[9px] border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                    : "text-[9px] text-muted-foreground"
                }
              >
                {data.verificada ? "Verificada" : "Sin verificar"}
              </Badge>
            </div>
            {data.url_evidencia ? (
              <a
                href={data.url_evidencia}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-fit"
              >
                <img
                  src={data.url_evidencia}
                  alt="Carátula bancaria del agente"
                  className="max-h-40 rounded-md border border-border object-contain bg-card"
                />
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ImageIcon className="h-3 w-3" /> Ver evidencia completa
                </span>
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">Sin evidencia cargada.</p>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
