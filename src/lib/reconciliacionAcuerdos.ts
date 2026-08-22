/**
 * Lectura del resultado de la RPC `reconciliar_acuerdos_precio_final`.
 *
 * La RPC devuelve **filas, no un objeto**, y omite la fila cuando la cuenta ya cuadraba.
 * El vocabulario de `accion` es cerrado:
 *
 *   (sin fila)         → ya cuadraba
 *   ajustado           → se ajustó el último acuerdo abierto  (requiere recalcular dispersión)
 *   ajustaria          → solo con p_dry_run: true, no escribió nada
 *   requiere_revision  → sin_acuerdo_abierto (cuenta liquidada → legal) | quedaria_negativo
 *   omitido            → cuenta_hija | precio_final_invalido | cuenta_inactiva
 *
 * `omitido` es el caso traicionero: no es error ni éxito, **no se hizo nada**. Si cae en la
 * rama de éxito el usuario lee "Acuerdos reconciliados" sobre una cuenta intacta.
 *
 * Este módulo centraliza la traducción para que los dos botones (admin CC y portal cobranza CC)
 * digan lo mismo, cada uno con su API de toast.
 */

export type AccionReconciliacion =
  | 'ajustado'
  | 'ajustaria'
  | 'requiere_revision'
  | 'omitido'
  | 'sin_cambio';

export interface FilaReconciliacion {
  accion?: AccionReconciliacion | string | null;
  motivo?: string | null;
  id_acuerdo?: number | null;
  precio_final?: number | string | null;
  suma_anterior?: number | string | null;
  monto_anterior?: number | string | null;
  monto_nuevo?: number | string | null;
  diferencia?: number | string | null;
}

export interface ResultadoReconciliacion {
  titulo: string;
  descripcion: string;
  tono: 'exito' | 'aviso';
  /** Solo `ajustado` movió el plan: hay que redistribuir los pagos de esa cuenta. */
  requiereRecalcularDispersion: boolean;
}

/** La RPC devuelve un set de filas; sin fila = la cuenta ya cuadraba. */
export function primeraFilaReconciliacion(data: unknown): FilaReconciliacion | null {
  if (Array.isArray(data)) return (data[0] as FilaReconciliacion) ?? null;
  if (data && typeof data === 'object') return data as FilaReconciliacion;
  return null;
}

// Son textos de TOAST: una línea, lo que hay que hacer. El detalle técnico va al
// logger, no a la pantalla del usuario.
const MOTIVOS_OMITIDO: Record<string, string> = {
  cuenta_hija: 'Las cuentas de mantenimiento no se reconcilian.',
  precio_final_invalido: 'Captura el precio de la cuenta primero.',
  cuenta_inactiva: 'La cuenta está inactiva.',
  reentrada: 'Ya se está reconciliando.',
};

export function interpretarReconciliacion(fila: FilaReconciliacion | null): ResultadoReconciliacion {
  const accion = fila?.accion ?? 'sin_cambio';

  // `fila === null` NO significa que ya cuadre. La RPC recorre solo cuentas con al
  // menos un acuerdo activo, así que una cuenta SIN plan se salta y no devuelve fila:
  // anunciar exito ahí era decirle al usuario que los acuerdos cuadran cuando no hay
  // acuerdos y el banner de descuadre sigue encendido (CC-000906, $29,000 sin plan).
  // Los dos casos se separan porque solo el explicito viene con fila.
  if (!fila) {
    return {
      titulo: 'Sin plan que reconciliar',
      descripcion: 'Cobranza tiene que asignarle un plan de pagos.',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'sin_cambio') {
    return {
      titulo: 'El plan ya cuadra',
      descripcion: '',
      tono: 'exito',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'ajustado') {
    return {
      titulo: 'Plan reconciliado',
      descripcion: 'Ya cuadra con el precio.',
      tono: 'exito',
      requiereRecalcularDispersion: true,
    };
  }

  if (accion === 'ajustaria') {
    return {
      titulo: 'Simulación',
      descripcion: 'No se guardó nada.',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'requiere_revision') {
    return {
      titulo: 'No se pudo ajustar solo',
      descripcion: fila.motivo === 'sin_acuerdo_abierto'
        ? 'El plan ya está pagado. Revisa el cuadre.'
        : fila.motivo === 'quedaria_negativo'
          ? 'El último acuerdo quedaría en negativo.'
          : 'Revísalo a mano.',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'omitido') {
    return {
      titulo: 'No aplica',
      descripcion: MOTIVOS_OMITIDO[fila.motivo ?? ''] ?? '',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  return {
    titulo: 'Revisa la cuenta',
    descripcion: 'No se pudo confirmar el resultado.',
    tono: 'aviso',
    requiereRecalcularDispersion: false,
  };
}
