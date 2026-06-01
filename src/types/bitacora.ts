/**
 * Shape de una entrada en `cuentas_cobranza.bitacora` (jsonb).
 * Ver `Ejecuciones_manuales/bitacora_cuenta_cobranza.md` para el DDL.
 *
 * La bitácora viene como un array de estas entradas, ordenado por
 * inserción (las nuevas se appendéan al final).
 */

export type BitacoraTipo = 'nota' | 'validacion' | 'rechazo' | 'sistema';

export type BitacoraScope =
  | 'expediente'
  | 'comprador_basica'
  | 'comprador_direccion'
  | 'comprador_fiscal'
  | 'documento';

export interface BitacoraReferencia {
  scope: BitacoraScope;
  idPersona?: number;
  idDocumento?: number;
}

export interface BitacoraEntry {
  id: string;
  timestamp: string;
  autorEmail: string;
  autorNombre?: string;
  tipo: BitacoraTipo;
  mensaje: string;
  referencia?: BitacoraReferencia;
}

export interface BitacoraEntryInput {
  tipo: BitacoraTipo;
  mensaje: string;
  referencia?: BitacoraReferencia;
}
