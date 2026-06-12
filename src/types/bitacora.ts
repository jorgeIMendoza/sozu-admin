/**
 * Shape de una entrada de bitácora. Persistido en la tabla dedicada
 * `legal_flow_bitacora` (una fila por entrada). Ver migración
 * 20260601000002_legal_flow_bitacora.sql.
 *
 * Las entradas se ordenan por `timestamp` ascendente (las nuevas se
 * appendéan al final).
 */

export type BitacoraTipo =
  | 'nota'
  | 'validacion'
  | 'rechazo'
  | 'sistema'
  | 'informacion_faltante';

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
  titulo?: string;
  mensaje: string;
  referencia?: BitacoraReferencia;
}

export interface BitacoraEntryInput {
  tipo: BitacoraTipo;
  titulo?: string;
  mensaje: string;
  referencia?: BitacoraReferencia;
}
