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
  MODELOS,
  MOTORES_SEMILLA,
  PROPIEDADES,
  PROYECTOS,
  TORRES,
} from "../mocks/inventario";

/** Simula la latencia de red para que la UI se pruebe con estados reales. */
function resolver<T>(valor: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(valor), 0));
}

// SWAP POINT: reemplazar por
//   supabase.from('proyectos').select('*').eq('activo', true)
export async function obtenerProyectos(): Promise<Proyecto[]> {
  return resolver(PROYECTOS.filter((p) => p.activo));
}

// SWAP POINT: reemplazar por
//   supabase.from('torres').select('*').eq('id_proyecto', idProyecto).eq('activo', true)
export async function obtenerTorres(idProyecto: string): Promise<Torre[]> {
  return resolver(TORRES.filter((t) => t.activo && t.id_proyecto === idProyecto));
}

// SWAP POINT: reemplazar por
//   supabase.from('modelos').select('*').eq('id_proyecto', idProyecto).eq('activo', true)
export async function obtenerModelos(idProyecto: string): Promise<Modelo[]> {
  return resolver(MODELOS.filter((m) => m.activo && m.id_proyecto === idProyecto));
}

// SWAP POINT: reemplazar por
//   supabase.from('propiedades')
//     .select('*, modelos!propiedades_id_modelo_fkey(*), torres!propiedades_id_torre_fkey(*)')
//     .eq('id_proyecto', idProyecto).eq('activo', true)
export async function obtenerPropiedades(idProyecto: string): Promise<Propiedad[]> {
  return resolver(PROPIEDADES.filter((p) => p.activo && p.id_proyecto === idProyecto));
}

// SWAP POINT: reemplazar por
//   supabase.from('motores_precio').select('*, factores_precio(*)')
//     .eq('id_proyecto', idProyecto).eq('activo', true).single()
export async function obtenerMotor(idProyecto: string): Promise<MotorPrecio> {
  const motor = MOTORES_SEMILLA[idProyecto];
  if (!motor) throw new Error(`No hay motor configurado para ${idProyecto}`);
  return resolver(structuredClone(motor));
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
