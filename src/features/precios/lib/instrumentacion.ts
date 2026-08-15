/**
 * Inventario declarado (no inferido) de los puntos de instrumentación de auditoría
 * que el módulo de Precios debería emitir hacia la bitácora. Cada entrada se marca
 * manualmente conforme se audita el código; no se calcula por búsqueda automática.
 */

export interface PuntoInstrumentacion {
  categoria: string;
  etiqueta: string;
  /** true = se confirmó una llamada a registrarEvento/conAuditoria en el punto de captura. */
  instrumentado: boolean;
  /** Nota breve sobre el estado, útil cuando instrumentado es false o es parcial. */
  nota?: string;
}

export const PUNTOS_INSTRUMENTACION: PuntoInstrumentacion[] = [
  { categoria: "Motor", etiqueta: "Parámetros base", instrumentado: true },
  { categoria: "Motor", etiqueta: "Curva de nivel", instrumentado: true },
  { categoria: "Motor", etiqueta: "Curva de tamaño", instrumentado: true },
  { categoria: "Motor", etiqueta: "Accesorios", instrumentado: true },
  {
    categoria: "Motor",
    etiqueta: "Factores (crear/editar/desactivar)",
    instrumentado: true,
  },
  {
    categoria: "Calibración",
    etiqueta: "Ejecutar",
    instrumentado: true,
  },
  {
    categoria: "Calibración",
    etiqueta: "Aplicar coeficientes",
    instrumentado: true,
  },
  {
    categoria: "Calibración",
    etiqueta: "Clasificar atípico",
    instrumentado: true,
  },
  {
    categoria: "Calibración",
    etiqueta: "Congelar baseline",
    instrumentado: true,
  },
  { categoria: "Precios", etiqueta: "Override individual", instrumentado: true },
  { categoria: "Precios", etiqueta: "Override masivo", instrumentado: true },
  {
    categoria: "Esquemas",
    etiqueta: "Crear/editar/desactivar/base",
    instrumentado: true,
  },
  {
    categoria: "Escenarios",
    etiqueta: "Guardar/archivar",
    instrumentado: true,
  },
  {
    categoria: "Ofertas",
    etiqueta: "Registrar/cancelar/vencer",
    instrumentado: true,
  },
  { categoria: "Versiones", etiqueta: "Crear/publicar/bloquear", instrumentado: true },
  {
    categoria: "Exportaciones",
    etiqueta: "CSV en todas las pantallas",
    instrumentado: true,
  },
];
