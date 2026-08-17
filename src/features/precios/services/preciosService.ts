/**
 * ADVERTENCIA DE ESQUEMA
 * Las tablas de SOZU usan nombres en plural y snake_case:
 *   proyectos, propiedades, modelos, personas, cuentas_cobranza
 *
 * DESAMBIGUACIÓN DE LLAVES FORÁNEAS
 * Cuando varias llaves foráneas apuntan a la misma tabla, PostgREST no puede
 * inferir la relación. Hay que nombrar el constraint explícitamente tanto en
 * el .select() del cliente como en SQL. Ejemplo del patrón vigente:
 *   personas!reservas_citas_id_persona_fkey
 * Omitirlo produce: "Could not embed because more than one relationship was found".
 *
 * NINGÚN DDL NI DML SE EJECUTA SIN FIRMA DE JORGE.
 */

import type { Modelo, MotorPrecio, Propiedad, Proyecto, Torre } from "../types/dominio";
import {
  obtenerInventarioProyecto,
  obtenerProyectosSozu,
} from "./inventarioReal";
import { construirMotorSemilla } from "../engine/semilla";
import { useMotorStore } from "../stores/motorStore";

/** Simula la latencia de red para que la UI se pruebe con estados reales. */
function resolver<T>(valor: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(valor), 0));
}

/** Proyectos comercializados por SOZU: el universo del módulo de Precios. */
export async function obtenerProyectos(): Promise<Proyecto[]> {
  return obtenerProyectosSozu();
}

export async function obtenerTorres(idProyecto: string): Promise<Torre[]> {
  return (await obtenerInventarioProyecto(idProyecto)).torres;
}

export async function obtenerModelos(idProyecto: string): Promise<Modelo[]> {
  return (await obtenerInventarioProyecto(idProyecto)).modelos;
}

export async function obtenerPropiedades(idProyecto: string): Promise<Propiedad[]> {
  return (await obtenerInventarioProyecto(idProyecto)).propiedades;
}

/**
 * Motor del proyecto.
 *
 * SWAP POINT pendiente: el motor todavía no tiene tablas (`motores_precio`,
 * `bases_modelo`, `factores_precio`), así que vive en el store local y, si el
 * proyecto no tiene uno, se deriva del inventario real. Lo que sí quedó
 * conectado a la base es el inventario sobre el que calcula.
 */
export async function obtenerMotor(idProyecto: string): Promise<MotorPrecio> {
  const guardado = useMotorStore.getState().motoresPorProyecto[idProyecto];
  if (guardado) return resolver(structuredClone(guardado));

  const proyectos = await obtenerProyectosSozu();
  const proyecto = proyectos.find((p) => p.id_proyecto === idProyecto);
  if (!proyecto) throw new Error(`El proyecto ${idProyecto} no lo comercializa SOZU`);

  const inv = await obtenerInventarioProyecto(idProyecto);
  const { motor } = construirMotorSemilla(
    idProyecto,
    proyecto.nombre,
    inv.torres,
    inv.modelos,
    inv.propiedades,
  );
  return motor;
}

// SWAP POINT: reemplazar por upsert sobre 'motores_precio' y 'factores_precio'
export async function guardarMotor(motor: MotorPrecio): Promise<void> {
  // Hoy el motor vive en el store de Zustand con persistencia local.
  void motor;
  return resolver(undefined);
}

// SWAP POINT: reemplazar por
//   supabase.from('overrides_precio').upsert({ id_propiedad, precio, motivo, creado_por })
export async function guardarOverride(
  idPropiedad: string,
  precio: number,
  motivo: string,
): Promise<void> {
  void idPropiedad;
  void precio;
  void motivo;
  return resolver(undefined);
}

// SWAP POINT: reemplazar por Edge Function 'publicar-lista-precios'
// La publicación NO se hace desde el cliente: escribe versión inmutable + bitácora.
export async function publicarVersion(
  idProyecto: string,
  nota: string,
): Promise<never> {
  void idProyecto;
  void nota;
  throw new Error("No implementado");
}
