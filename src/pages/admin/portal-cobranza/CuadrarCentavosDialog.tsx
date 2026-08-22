/**
 * Cuadre del residuo de redondeo entre el precio de la cuenta y la suma del plan.
 *
 * El plan se genera dividiendo el precio entre N parcialidades y redondeando cada
 * una a dos decimales. El residuo (hasta N centavos) nunca se asigna, así que la
 * suma de acuerdos queda por debajo del precio y el cliente termina con dinero
 * cobrado que no se puede aplicar: no hay acuerdo abierto que lo reciba. Ese es el
 * caso de la CC-000069 — el cliente pagó los $2,673,946.20 completos, el plan solo
 * suma $2,673,946.08, y la pantalla exhibía $0.12 como deuda.
 *
 * La RPC `cuadrar_centavos_cuenta` sube el ÚLTIMO acuerdo por la diferencia y
 * aplica el dinero que ya estaba cobrado. Sus dos guardas viven en la base, no
 * aquí:
 *
 *   · la diferencia no puede exceder N centavos (N = número de acuerdos). Si la
 *     excede no es redondeo: es un monto de negocio y devuelve `requiere_revision`.
 *   · solo ajusta si hay dinero cobrado sin aplicar que cubra la diferencia. Si no
 *     alcanza, el cliente debe de verdad y la RPC no toca nada.
 *
 * Este diálogo hace dos cosas: enseña el dry-run ANTES de escribir, y cuando la
 * base pide revisión exige que una persona confirme contra el documento que fija
 * el precio. Nunca aplica sin que se vea qué va a cambiar.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ScrollText } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fmtCurrency } from './cuentaDetalleShared';

/** Respuesta de `cuadrar_centavos_cuenta`. Los campos varían según la acción. */
interface Cuadre {
  accion: 'dry_run' | 'cuadrada' | 'omitido' | 'requiere_revision';
  motivo?: string | null;
  motivo_rechazo?: string | null;
  precio_final?: number;
  suma_plan?: number;
  diferencia?: number;
  tolerancia?: number;
  acuerdos?: number;
  id_acuerdo_a_ajustar?: number;
  monto_actual?: number;
  monto_nuevo?: number;
  dinero_sin_aplicar?: number;
  se_aplicaria?: boolean;
  aplicado?: number;
  quedo_liquidada?: boolean;
}

/** Texto para cada motivo por el que la base se niega a cuadrar sola. */
const MOTIVOS: Record<string, { titulo: string; detalle: string; salida: string }> = {
  diferencia_mayor_a_redondeo: {
    titulo: 'La diferencia no es un residuo de redondeo',
    detalle:
      'Supera lo que puede explicarse por redondear las parcialidades, así que corresponde a un monto de negocio: un cambio de precio, un descuento o un concepto que no se reflejó en el plan.',
    salida:
      'Verifica el importe contra el documento que fija el precio — el contrato en una propiedad, la oferta en un producto. Si el precio de la cuenta es el correcto, puedes aplicar el cuadre y el último acuerdo absorberá la diferencia. Si el precio es el que está mal, corrígelo primero: aplicar el cuadre movería el plan hacia un precio equivocado.',
  },
  sin_dinero_para_cubrir_la_diferencia: {
    titulo: 'No hay dinero cobrado que cubra la diferencia',
    detalle:
      'La diferencia es saldo que el cliente no ha pagado, no un residuo.',
    salida:
      'Registra el pago faltante, o ajusta el precio si el correcto es el del plan.',
  },
  plan_excede_precio: {
    titulo: 'El plan pide más de lo que vale la cuenta',
    detalle:
      'El plan suma más que el precio. Este cuadre solo sube el último acuerdo, nunca lo baja.',
    salida:
      'Revisa el precio contra el contrato o la oferta y corrige el que esté mal.',
  },
  usar_reconciliacion_normal: {
    titulo: 'La cuenta todavía tiene acuerdos abiertos',
    detalle: 'Con un acuerdo abierto el ajuste normal la absorbe.',
    salida: 'Usa «Reconciliar acuerdos».',
  },
  sin_plan: {
    titulo: 'La cuenta no tiene plan de pagos',
    detalle: 'El plan nunca se generó.',
    salida: 'Cobranza tiene que asignarle un plan.',
  },
  ya_cuadra: {
    titulo: 'La cuenta ya está cuadrada',
    detalle: 'La suma del plan coincide con el precio final.',
    salida: 'No hay nada que aplicar.',
  },
  cuenta_hija: {
    titulo: 'Es una cuenta de mantenimiento',
    detalle: 'Su plan es recurrente y no se compara contra un precio.',
    salida: 'No aplica.',
  },
  precio_final_invalido: {
    titulo: 'El precio de la cuenta no es válido',
    detalle: 'Está en cero o vacío.',
    salida: 'Captúralo en «Editar Cuenta».',
  },
  cuenta_inexistente_o_cancelada: {
    titulo: 'La cuenta está cancelada',
    detalle: 'No se modifican planes de cuentas canceladas.',
    salida: 'No aplica.',
  },
};

export function CuadrarCentavosDialog({ open, onOpenChange, cuentaId, onAplicado }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuentaId: number;
  /** Se llama tras un cuadre exitoso, para refrescar la pantalla. */
  onAplicado: () => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [cuadre, setCuadre] = useState<Cuadre | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validado, setValidado] = useState(false);

  // Simulación al abrir: nunca se muestra un botón de aplicar sin saber qué haría.
  useEffect(() => {
    if (!open) { setCuadre(null); setError(null); setValidado(false); return; }
    let vivo = true;
    (async () => {
      setCargando(true);
      const { data, error: e } = await (supabase as any).rpc('cuadrar_centavos_cuenta', {
        p_id_cuenta_cobranza: cuentaId,
        p_dry_run: true,
      });
      if (!vivo) return;
      setCargando(false);
      if (e) {
        // 42501 = falta el GRANT; 42883 = la RPC no existe en este ambiente. El codigo
        // va al logger, nunca a la pantalla.
        console.error('[cobranza] simular cuadre', e);
        setError(
          e.code === '42501' || /permission denied/i.test(e.message ?? '')
            ? 'No tienes permiso para cuadrar. Pídelo a un administrador.'
            : 'No se pudo revisar el cuadre.',
        );
        return;
      }
      setCuadre(data as Cuadre);
    })();
    return () => { vivo = false; };
  }, [open, cuentaId]);

  const aplicar = async () => {
    setAplicando(true);
    const { data, error: e } = await (supabase as any).rpc('cuadrar_centavos_cuenta', {
      p_id_cuenta_cobranza: cuentaId,
      p_dry_run: false,
    });
    setAplicando(false);
    if (e) {
      console.error('[cobranza] cuadrar centavos', e);
      toast.error('No se pudo aplicar el cuadre');
      return;
    }
    const r = data as Cuadre;
    if (r.accion === 'cuadrada') {
      toast.success('Cuenta cuadrada', {
        description: `Se aplicaron ${fmtCurrency(r.diferencia ?? 0)}.`,
      });
      onAplicado();
      onOpenChange(false);
      return;
    }
    // La base rechazó en firme: se muestra su motivo en vez de un éxito falso.
    setCuadre(r);
    toast.error('No se aplicó el cuadre', {
      description: MOTIVOS[r.motivo ?? '']?.titulo ?? '',
    });
  };

  // `dry_run` + `se_aplicaria` es el único caso que la base cuadra sola.
  const listoParaAplicar = cuadre?.accion === 'dry_run' && cuadre.se_aplicaria === true;
  // Rechazo que una persona puede levantar validando contra el contrato.
  const motivoBloqueo = cuadre
    ? (cuadre.accion === 'dry_run' ? (cuadre.motivo_rechazo ?? null) : (cuadre.motivo ?? null))
    : null;
  const info = motivoBloqueo ? MOTIVOS[motivoBloqueo] : null;
  // Solo la diferencia de negocio se puede forzar con validación humana. Que no
  // haya dinero, o que el plan exceda el precio, no se arregla con un checkbox.
  const permiteForzar = motivoBloqueo === 'diferencia_mayor_a_redondeo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Cuadrar el plan con el precio de la cuenta</DialogTitle>
          <DialogDescription>
            El último acuerdo absorbe la diferencia y se aplica el dinero que ya estaba cobrado.
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" /> Revisando la cuenta…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
            {error}
          </div>
        )}

        {cuadre && !cargando && (
          <div className="space-y-3">
            {/* Cifras: siempre visibles, apliquemos o no. */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-[13px]">
              <Fila label="Precio final de la cuenta" valor={cuadre.precio_final} />
              <Fila label="Suma del plan de pagos" valor={cuadre.suma_plan} />
              <Fila label="Diferencia" valor={cuadre.diferencia} destacar />
              {cuadre.acuerdos != null && (
                <Fila
                  label={`Máximo por redondeo (${cuadre.acuerdos} acuerdo${cuadre.acuerdos !== 1 ? 's' : ''})`}
                  valor={cuadre.tolerancia}
                />
              )}
              {cuadre.dinero_sin_aplicar != null && (
                <Fila label="Dinero cobrado sin aplicar" valor={cuadre.dinero_sin_aplicar} />
              )}
            </div>

            {listoParaAplicar && (
              <>
                <div className="flex gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-[12.5px] text-emerald-900">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <p>
                    Es un residuo de redondeo y el dinero ya está cobrado. El cliente no debe nada.
                  </p>
                </div>
                {cuadre.monto_actual != null && (
                  <p className="text-[12px] text-muted-foreground px-1">
                    El acuerdo #{cuadre.id_acuerdo_a_ajustar} pasa de{' '}
                    <strong className="text-foreground">{fmtCurrency(cuadre.monto_actual)}</strong> a{' '}
                    <strong className="text-foreground">{fmtCurrency(cuadre.monto_nuevo)}</strong>.
                  </p>
                )}
              </>
            )}

            {info && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="font-semibold">{info.titulo}</p>
                  <p>{info.detalle}</p>
                  <p>{info.salida}</p>
                </div>
              </div>
            )}

            {permiteForzar && (
              <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <Checkbox
                  checked={validado}
                  onCheckedChange={(v) => setValidado(v === true)}
                  className="mt-0.5"
                />
                <span className="text-[12.5px] leading-relaxed">
                  <span className="font-semibold flex items-center gap-1.5">
                    <ScrollText className="size-3.5" />
                    Revisé el documento que fija el precio y confirmo que el de la cuenta es correcto
                  </span>
                  <span className="text-muted-foreground">
                    Al aplicar cambia el importe del último acuerdo. Con un precio equivocado, el
                    cliente lo vería así en su estado de cuenta.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>
            Cerrar
          </Button>
          {(listoParaAplicar || permiteForzar) && (
            <Button
              onClick={aplicar}
              disabled={aplicando || (permiteForzar && !validado)}
            >
              {aplicando && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Aplicar cuadre
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fila({ label, valor, destacar }: { label: string; valor?: number | null; destacar?: boolean }) {
  if (valor == null) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={destacar ? 'font-bold tabular-nums' : 'font-medium tabular-nums'}>
        {fmtCurrency(valor)}
      </span>
    </div>
  );
}
