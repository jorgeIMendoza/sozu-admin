/**
 * MIGRACIÓN A SUPABASE — REQUIERE FIRMA DE JORGE
 *
 * Tablas requeridas (plural, snake_case, consistente con el esquema vigente:
 * proyectos, propiedades, personas, cuentas_cobranza):
 *   bitacora_precio        append-only, sin UPDATE ni DELETE por política RLS
 *   versiones_lista        inmutable en estado 'publicada'
 *   precios_version        snapshot por unidad y versión
 *   ofertas_vigentes       con índice sobre (id_propiedad, estado)
 *
 * bitacora_precio crece sin límite. Considerar partición por rango de fecha
 * y política de archivado en frío. No truncar: es evidencia regulatoria.
 *
 * La escritura de eventos NO debe hacerse desde el cliente. Debe ocurrir en
 * una Edge Function que sea la única con permiso de INSERT sobre bitacora_precio,
 * calculando el hash del lado del servidor. Un hash calculado en el navegador
 * no es prueba de nada.
 *
 * DESAMBIGUACIÓN DE LLAVES FORÁNEAS: cuando varias FK apuntan a la misma tabla
 * (bitacora_precio y ofertas_vigentes referencian personas más de una vez),
 * PostgREST no puede inferir la relación. Nombrar el constraint explícitamente
 * tanto en el .select() del cliente como en SQL. Patrón vigente:
 *   personas!reservas_citas_id_persona_fkey
 */

import type { ActorEvento, EventoAuditoria, TipoEvento } from "../types/dominio";
import { useBitacoraStore } from "../stores/bitacoraStore";
import { descargarCSV } from "../lib/csv";

/** Actor de la sesión. SWAP POINT: vendrá de la sesión autenticada. */
export const ACTOR_ACTUAL: ActorEvento = {
  id_persona: "per-ramon-escobar",
  nombre: "Ramón Escobar",
  rol: "Super Administrador",
};

export interface DatosEvento {
  id_proyecto: string;
  tipo: TipoEvento;
  entidad: { tipo: string; id: string; etiqueta: string };
  antes?: unknown;
  despues?: unknown;
  impacto_pesos?: number | null;
  motivo?: { causa: string; descripcion: string } | null;
  /** Actor alterno (datos de demostración). Por omisión, el actor de la sesión. */
  actor?: ActorEvento;
  /** Fecha real del hecho cuando difiere del momento de registro. */
  ocurrido_en?: string;
}

/** Actor de los eventos sembrados por las herramientas de demostración. */
export const ACTOR_DEMO: ActorEvento = {
  id_persona: "per-demo-datos-prueba",
  nombre: "Demo · Datos de prueba",
  rol: "Simulación",
};

/** Cola secuencial: el encadenamiento exige un escritor a la vez. */
let cola: Promise<unknown> = Promise.resolve();

/** Escribe un evento en la bitácora. No bloquea al llamador. */
export function registrarEvento(datos: DatosEvento): Promise<EventoAuditoria | null> {
  const siguiente = cola.then(() =>
    useBitacoraStore
      .getState()
      .registrar({ ...datos, actor: datos.actor ?? ACTOR_ACTUAL })
      .catch((e) => {
        console.error("No se pudo registrar el evento de auditoría", e);
        return null;
      }),
  );
  cola = siguiente;
  return siguiente as Promise<EventoAuditoria | null>;
}

/**
 * Envuelve una acción existente para que emita su evento después de ejecutarse.
 * Ninguna acción de store se reescribe: la auditoría vive en el punto de llamada.
 */
 
export function conAuditoria<T extends (...a: any[]) => any>(
  accion: T,
  describir: (...a: Parameters<T>) => DatosEvento | null,
): T {
  return ((...args: Parameters<T>) => {
    const resultado = accion(...args);
    const datos = describir(...args);
    if (datos) registrarEvento(datos);
    return resultado;
  }) as T;
}

/** Exporta un CSV y deja constancia de la salida de datos. */
export function exportarCSVAuditado(
  opciones: {
    id_proyecto: string;
    origen: string;
    filtros?: Record<string, unknown>;
  },
  nombreArchivo: string,
  encabezados: string[],
  filas: Array<Array<string | number>>,
): void {
  descargarCSV(nombreArchivo, encabezados, filas);
  registrarEvento({
    id_proyecto: opciones.id_proyecto,
    tipo: "exportacion.csv",
    entidad: { tipo: "exportacion", id: nombreArchivo, etiqueta: opciones.origen },
    antes: null,
    despues: {
      archivo: nombreArchivo,
      filas_exportadas: filas.length,
      columnas: encabezados,
      filtros: opciones.filtros ?? {},
    },
  });
}

/** Nombres legibles de cada tipo de evento. */
export const ETIQUETA_EVENTO: Record<TipoEvento, string> = {
  "motor.parametro_actualizado": "Parámetro del motor actualizado",
  "motor.factor_creado": "Factor creado",
  "motor.factor_actualizado": "Factor actualizado",
  "motor.factor_desactivado": "Factor desactivado",
  "motor.factor_reactivado": "Factor reactivado",
  "motor.punto_base": "Motor llevado al punto base",
  "motor.restablecido": "Motor restablecido",
  "calibracion.ejecutada": "Calibración ejecutada",
  "calibracion.declarada_manualmente": "Calibración declarada manualmente",
  "calibracion.coeficientes_aplicados": "Coeficientes aplicados",
  "calibracion.atipico_clasificado": "Atípico clasificado",
  "calibracion.baseline_congelado": "Baseline congelado",
  "precio.override_aplicado": "Override aplicado",
  "precio.override_removido": "Override removido",
  "precio.override_masivo": "Override masivo",
  "esquema.creado": "Esquema creado",
  "esquema.actualizado": "Esquema actualizado",
  "esquema.desactivado": "Esquema desactivado",
  "esquema.marcado_base": "Esquema marcado como base",
  "escenario.guardado": "Escenario guardado",
  "escenario.archivado": "Escenario archivado",
  "oferta.registrada": "Oferta registrada",
  "oferta.cancelada": "Oferta cancelada",
  "oferta.vencida": "Oferta vencida",
  "version.creada": "Versión creada",
  "version.publicada": "Versión publicada",
  "version.archivada": "Versión archivada",
  "version.publicacion_bloqueada": "Publicación bloqueada",
  "exportacion.csv": "Exportación a CSV",
};

export type CategoriaEvento =
  | "Motor"
  | "Calibración"
  | "Precios"
  | "Esquemas"
  | "Escenarios"
  | "Ofertas"
  | "Versiones"
  | "Exportaciones";

export function categoriaDe(tipo: TipoEvento): CategoriaEvento {
  const prefijo = tipo.split(".")[0];
  switch (prefijo) {
    case "motor":
      return "Motor";
    case "calibracion":
      return "Calibración";
    case "precio":
      return "Precios";
    case "esquema":
      return "Esquemas";
    case "escenario":
      return "Escenarios";
    case "oferta":
      return "Ofertas";
    case "version":
      return "Versiones";
    default:
      return "Exportaciones";
  }
}

export const CATEGORIAS: CategoriaEvento[] = [
  "Motor",
  "Calibración",
  "Precios",
  "Esquemas",
  "Escenarios",
  "Ofertas",
  "Versiones",
  "Exportaciones",
];

export const TIPOS_EVENTO = Object.keys(ETIQUETA_EVENTO) as TipoEvento[];
