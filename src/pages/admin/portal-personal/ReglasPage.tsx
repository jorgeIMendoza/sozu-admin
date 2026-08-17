
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { REGLAS } from "@/lib/portal-personal/mock";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { Button } from "@/components/ui/button";


export default function ReglasPage() {
  const usuario = usePortal((s) => s.usuario);
  const aceptar = usePortal((s) => s.aceptarReglas);
  const aceptada = usuario.reglas_aceptadas_version === REGLAS.version;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* SWAP POINT: supabase.reglas_programa */}
      <header className="card-sozu p-6">
        <h2 className="text-xl font-bold text-negro">Reglas del Programa de Referidos</h2>
        <p className="num mt-1 text-sm text-gris">
          Versión {REGLAS.version} · Vigente desde {REGLAS.vigente_desde}
        </p>
      </header>

      <article className="card-sozu space-y-7 p-6">
        {REGLAS.secciones.map((s) => (
          <section key={s.titulo}>
            <h3 className="text-base font-bold text-negro">{s.titulo}</h3>
            {s.cuerpo.map((p) => (
              <p key={p} className="mt-2 text-sm leading-relaxed text-gris">
                {p}
              </p>
            ))}
          </section>
        ))}

        <section className="rounded-xl bg-secondary p-5">
          <h3 className="text-base font-bold text-negro">Naturaleza del programa</h3>
          <p className="mt-2 text-sm leading-relaxed text-gris">
            Este es un programa extraordinario y temporal por campaña. No constituye una
            prestación laboral permanente ni un derecho adquirido. SOZU se reserva el derecho de
            modificarlo, suspenderlo o darlo por terminado en cualquier momento, notificando a los
            participantes.
          </p>
        </section>
      </article>

      {/* SWAP POINT: supabase.logs_auditoria (append-only) */}
      {aceptada ? (
        <div className="flex items-center gap-2 rounded-xl border border-verde/30 bg-verde-claro p-4 text-sm font-semibold text-verde-oscuro">
          <CheckCircle2 className="size-4" />
          Aceptaste las reglas v{REGLAS.version}
        </div>
      ) : (
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            aceptar(REGLAS.version);
            toast.success("Aceptación registrada");
          }}
        >
          Acepto las reglas v{REGLAS.version}
        </Button>
      )}
    </div>
  );
}
