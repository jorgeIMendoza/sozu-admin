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

const MOTIVOS_OMITIDO: Record<string, string> = {
  cuenta_hija:
    'Es una cuenta de mantenimiento: su plan es recurrente y no se compara contra un precio de contrato.',
  precio_final_invalido:
    'La cuenta no tiene un precio final válido, así que no hay contra qué reconciliar.',
  cuenta_inactiva: 'La cuenta está inactiva.',
  reentrada: 'La reconciliación ya venía corriendo.',
};

export function interpretarReconciliacion(fila: FilaReconciliacion | null): ResultadoReconciliacion {
  const accion = fila?.accion ?? 'sin_cambio';

  if (!fila || accion === 'sin_cambio') {
    return {
      titulo: 'Sin cambios',
      descripcion: 'Los acuerdos ya cuadran con el precio final.',
      tono: 'exito',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'ajustado') {
    return {
      titulo: 'Acuerdos reconciliados',
      descripcion: 'La suma de acuerdos ya cuadra con el precio final.',
      tono: 'exito',
      requiereRecalcularDispersion: true,
    };
  }

  if (accion === 'ajustaria') {
    return {
      titulo: 'Simulación',
      descripcion: 'Así quedaría el ajuste. No se guardó nada.',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'requiere_revision') {
    return {
      titulo: 'Requiere revisión',
      descripcion: fila.motivo === 'sin_acuerdo_abierto'
        ? 'La cuenta está liquidada: todos sus acuerdos ya están pagados, así que la diferencia se revisa con legal contra el contrato.'
        : fila.motivo === 'quedaria_negativo'
          ? 'El ajuste dejaría el último acuerdo en negativo. Hay que revisarlo a mano.'
          : 'No se pudo ajustar automáticamente; revisar a mano.',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  if (accion === 'omitido') {
    return {
      titulo: 'No aplica',
      descripcion: MOTIVOS_OMITIDO[fila.motivo ?? ''] ?? 'Esta cuenta no entra en la reconciliación.',
      tono: 'aviso',
      requiereRecalcularDispersion: false,
    };
  }

  // Acción desconocida: no afirmar que se reconcilió algo.
  return {
    titulo: 'Sin confirmar',
    descripcion: 'La reconciliación devolvió un resultado que no se pudo interpretar. Revisa la cuenta antes de continuar.',
    tono: 'aviso',
    requiereRecalcularDispersion: false,
  };
}
