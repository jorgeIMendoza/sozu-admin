/**
 * Siembra eventos de demostración en la bitácora, en orden cronológico ascendente,
 * escribiendo uno a la vez para no romper el encadenamiento de hashes. Nunca borra
 * ni reinicia la cadena existente: solo agrega eventos nuevos al final.
 */
import { ACTOR_DEMO, registrarEvento } from "../services/auditoria";
import { useInventarioStore } from "../stores/inventarioStore";
import type { DatosEvento } from "../services/auditoria";

function haceDias(dias: number, horas = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(horas, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

/** Genera y registra 25 eventos de demostración, distribuidos en los últimos 20 días. */
export async function sembrarBitacoraDemo(idProyecto: string): Promise<void> {
  // Inventario real ya cargado del proyecto: la semilla de demo se apoya en
  // unidades que existen, no en un catálogo aparte.
  const props = useInventarioStore
    .getState()
    .inventarioDe(idProyecto)
    .propiedades.filter((p) => p.activo);
  const u = (i: number) => props[i % props.length]!;

  // Distribución de días hacia atrás, ascendente en el tiempo (el evento 0 es el más antiguo).
  const dias = [
    20, 19, 19, 18, 17, 16, 16, 15, 14, 13, 12, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1, 0,
  ];

  const eventos: Array<Omit<DatosEvento, "actor" | "ocurrido_en">> = [];

  // Motor: 10 eventos variados
  eventos.push(
    {
      id_proyecto: idProyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Precio base por m²" },
      antes: 32000,
      despues: 32800,
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Factor de área exterior (k_ext)" },
      antes: 0.55,
      despues: 0.5,
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Curva de nivel" },
      antes: { coef_a: 0.004, coef_b: 1.0 },
      despues: { coef_a: 0.0045, coef_b: 1.0 },
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Curva de tamaño" },
      antes: { m2_referencia: 65, theta: 0.12 },
      despues: { m2_referencia: 65, theta: 0.14 },
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Precio por cajón" },
      antes: 120000,
      despues: 130000,
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Precio por m² de bodega" },
      antes: 8500,
      despues: 9000,
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.factor_creado",
      entidad: { tipo: "factor", id: "fac-demo-vista-jardin", etiqueta: "vista · Vista a jardín" },
      antes: null,
      despues: { clave: "vista_jardin", etiqueta: "Vista a jardín", valor: 1.02 },
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.factor_creado",
      entidad: { tipo: "factor", id: "fac-demo-esquina", etiqueta: "plano · Departamento esquina" },
      antes: null,
      despues: { clave: "esquina", etiqueta: "Departamento esquina", valor: 1.03 },
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.factor_actualizado",
      entidad: { tipo: "factor", id: "fac-demo-vista-jardin", etiqueta: "Vista a jardín" },
      antes: 1.02,
      despues: 1.025,
    },
    {
      id_proyecto: idProyecto,
      tipo: "motor.factor_desactivado",
      entidad: { tipo: "factor", id: "fac-demo-esquina", etiqueta: "Departamento esquina" },
      antes: { activo: true },
      despues: { activo: false },
    },
  );

  // Calibración: ejecutar + aplicar coeficientes
  eventos.push(
    {
      id_proyecto: idProyecto,
      tipo: "calibracion.ejecutada",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Calibración de mercado" },
      antes: null,
      despues: { comparables_usados: 18, r2: 0.87 },
    },
    {
      id_proyecto: idProyecto,
      tipo: "calibracion.coeficientes_aplicados",
      entidad: { tipo: "motor", id: "motor-demo", etiqueta: "Coeficientes calibrados" },
      antes: { precio_base_m2: 32800 },
      despues: { precio_base_m2: 33400 },
    },
  );

  // Overrides individuales, tres causas distintas
  const p0 = u(0);
  const p1 = u(1);
  const p2 = u(2);
  eventos.push(
    {
      id_proyecto: idProyecto,
      tipo: "precio.override_aplicado",
      entidad: { tipo: "propiedad", id: p0.id_propiedad, etiqueta: `Unidad ${p0.numero}` },
      antes: p0.precio_lista_actual,
      despues: Math.round(p0.precio_lista_actual * 0.97),
      motivo: {
        causa: "Unidad muestra o departamento piloto",
        descripcion: "Unidad usada como departamento muestra; se ajusta el precio para reflejar el desgaste por exhibición.",
      },
    },
    {
      id_proyecto: idProyecto,
      tipo: "precio.override_aplicado",
      entidad: { tipo: "propiedad", id: p1.id_propiedad, etiqueta: `Unidad ${p1.numero}` },
      antes: p1.precio_lista_actual,
      despues: Math.round(p1.precio_lista_actual * 1.02),
      motivo: {
        causa: "Acuerdo comercial cerrado previamente",
        descripcion: "Precio pactado con el cliente en una negociación anterior a la actualización del motor.",
      },
    },
    {
      id_proyecto: idProyecto,
      tipo: "precio.override_aplicado",
      entidad: { tipo: "propiedad", id: p2.id_propiedad, etiqueta: `Unidad ${p2.numero}` },
      antes: p2.precio_lista_actual,
      despues: Math.round(p2.precio_lista_actual * 0.95),
      motivo: {
        causa: "Condición física particular de la unidad",
        descripcion: "La unidad presenta una vista parcialmente obstruida por una estructura vecina no considerada en el motor.",
      },
    },
  );

  // Override masivo: 4 unidades individuales + evento agregado
  const lote = [u(3), u(4), u(5), u(6)];
  for (const p of lote) {
    eventos.push({
      id_proyecto: idProyecto,
      tipo: "precio.override_aplicado",
      entidad: { tipo: "propiedad", id: p.id_propiedad, etiqueta: `Unidad ${p.numero}` },
      antes: p.precio_lista_actual,
      despues: Math.round(p.precio_lista_actual * 0.98),
      motivo: {
        causa: "Instrucción del desarrollador",
        descripcion: "Ajuste masivo instruido por el desarrollador para la torre en promoción del mes.",
      },
    });
  }
  eventos.push({
    id_proyecto: idProyecto,
    tipo: "precio.override_masivo",
    entidad: { tipo: "lote", id: "lote-demo-promocion", etiqueta: "Promoción del mes · 4 unidades" },
    antes: null,
    despues: {
      unidades: lote.map((p) => p.id_propiedad),
      ajuste_pct: -2,
      causa: "Instrucción del desarrollador",
    },
  });

  // Esquema creado
  eventos.push({
    id_proyecto: idProyecto,
    tipo: "esquema.creado",
    entidad: { tipo: "esquema", id: "esq-demo-preventa-flex", etiqueta: "Preventa flexible 18 meses" },
    antes: null,
    despues: { tipo_esquema: "preventa", pct_enganche: 20, num_mensualidades: 18 },
  });

  // Ofertas registradas
  const p7 = u(7);
  const p8 = u(8);
  eventos.push(
    {
      id_proyecto: idProyecto,
      tipo: "oferta.registrada",
      entidad: { tipo: "oferta", id: "oferta-demo-1", etiqueta: `Unidad ${p7.numero}` },
      antes: null,
      despues: { precio_ofertado: Math.round(p7.precio_lista_actual * 0.98), vigencia_dias: 15 },
    },
    {
      id_proyecto: idProyecto,
      tipo: "oferta.registrada",
      entidad: { tipo: "oferta", id: "oferta-demo-2", etiqueta: `Unidad ${p8.numero}` },
      antes: null,
      despues: { precio_ofertado: Math.round(p8.precio_lista_actual * 0.99), vigencia_dias: 10 },
    },
  );

  // Exportación CSV
  eventos.push({
    id_proyecto: idProyecto,
    tipo: "exportacion.csv",
    entidad: { tipo: "exportacion", id: "export-demo.csv", etiqueta: "Tabla de precios" },
    antes: null,
    despues: { archivo: "export-demo.csv", filas_exportadas: 42 },
  });

  // Versión con publicación bloqueada
  eventos.push({
    id_proyecto: idProyecto,
    tipo: "version.publicacion_bloqueada",
    entidad: { tipo: "version", id: "version-demo-3", etiqueta: "Versión 3 · borrador" },
    antes: null,
    despues: { motivo: "Existen alertas críticas sin resolver en 2 unidades." },
  });

  const total = Math.min(eventos.length, dias.length, 25);
  for (let i = 0; i < total; i++) {
    await registrarEvento({
      ...eventos[i]!,
      actor: ACTOR_DEMO,
      ocurrido_en: haceDias(dias[i]!),
    });
  }
}
