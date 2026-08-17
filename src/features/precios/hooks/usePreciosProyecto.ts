import { useEffect, useMemo, useRef } from "react";
import { agregarAlertas, calcularLote } from "../engine/pricing";
import { MOTOR_VACIO } from "../engine/semilla";
import { useInventarioStore } from "../stores/inventarioStore";
import { useMotorStore } from "../stores/motorStore";
import { useListaStore } from "../stores/listaStore";
import {
  idsConConversionPendiente,
  idsConOfertaVigente,
  useOfertasStore,
} from "../stores/ofertasStore";
import { registrarEvento } from "../services/auditoria";

/**
 * Calcula el desglose de precios del proyecto activo con el motor vigente,
 * sobre el **inventario real** del proyecto (`inventarioStore`).
 *
 * Mientras el proyecto no esté elegido o su inventario no haya cargado devuelve
 * el motor neutro (`MOTOR_VACIO`) y `motorListo: false`. Con datos por red ya no
 * hay motor disponible en el primer render, y devolver un motor que calcula 0 es
 * más seguro que un `null` que cada pantalla tendría que recordar contemplar.
 */
export function usePreciosProyecto() {
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);
  const motoresPorProyecto = useMotorStore((s) => s.motoresPorProyecto);
  const overrides = useListaStore((s) => s.overrides);
  const ofertas = useOfertasStore((s) => s.ofertas);
  const recalcularVencimientos = useOfertasStore((s) => s.recalcularVencimientos);

  const porProyecto = useInventarioStore((s) => s.porProyecto);
  const indicesPorProyecto = useInventarioStore((s) => s.indices);
  const cargandoPorProyecto = useInventarioStore((s) => s.cargando);

  const motorGuardado = motoresPorProyecto[idProyectoActivo] ?? null;
  // Motor neutro mientras no hay uno sembrado: evita que cada pantalla tenga
  // que defenderse de un null en el primer render.
  const motor = motorGuardado ?? MOTOR_VACIO;
  const motorListo = motorGuardado !== null;
  const inventario = porProyecto[idProyectoActivo];
  const indices = indicesPorProyecto[idProyectoActivo];
  const cargando = !!cargandoPorProyecto[idProyectoActivo];
  const cargado = inventario !== undefined;

  // SWAP POINT: en producción esto corre como tarea programada del lado del servidor, no al montar el cliente.
  const yaRecalculado = useRef(false);
  useEffect(() => {
    if (yaRecalculado.current || !cargado) return;
    yaRecalculado.current = true;
    const vencidas = recalcularVencimientos();
    const propiedadesPorId = indices?.propiedadesPorId ?? {};
    for (const o of vencidas) {
      registrarEvento({
        id_proyecto: o.id_proyecto,
        tipo: "oferta.vencida",
        entidad: {
          tipo: "oferta",
          id: o.id_oferta,
          etiqueta: `Unidad ${propiedadesPorId[o.id_propiedad]?.numero ?? o.id_propiedad}`,
        },
        antes: { estado: "vigente", vence_en: o.vence_en },
        despues: { estado: "vencida" },
        ocurrido_en: o.vence_en,
      });
    }
  }, [recalcularVencimientos, cargado, indices]);

  const conOfertaVigente = useMemo(
    () => idsConOfertaVigente(ofertas, idProyectoActivo),
    [ofertas, idProyectoActivo],
  );

  const conConversionPendiente = useMemo(
    () =>
      idsConConversionPendiente(
        ofertas,
        idProyectoActivo,
        (id) => indices?.propiedadesPorId[id]?.estatus,
      ),
    [ofertas, idProyectoActivo, indices],
  );

  /*
   * `propiedades` y `desgloses` son un par: cada unidad que se devuelve tiene
   * su desglose calculado. Se gatean juntas contra `motorListo` porque romper
   * esa correspondencia rompe a quien las cruza — la Tabla de Precios hace
   * `porId.get(p.id_propiedad)!` y con unidades sin desglose reventaba el
   * módulo entero. Sin motor no hay precios que mostrar, y el encabezado ya
   * explica que está cargando.
   */
  const propiedades = useMemo(
    () => (motorListo ? (inventario?.propiedades ?? []).filter((p) => p.activo) : []),
    [inventario, motorListo],
  );

  const torresProyecto = useMemo(() => inventario?.torres ?? [], [inventario]);

  const desgloses = useMemo(
    () =>
      !motorListo
        ? []
        : calcularLote(
        propiedades,
        {
          modelos: indices?.modelosPorId ?? {},
          torres: indices?.torresPorId ?? {},
          overrides: Object.fromEntries(
            Object.entries(overrides).map(([k, v]) => [
              k,
              {
                precio: v.precio,
                causa: v.causa,
                descripcion: v.descripcion,
                precio_motor_al_aplicar: v.precio_motor_al_aplicar,
              },
            ]),
          ),
          conOfertaVigente,
          conConversionPendiente,
        },
        motor,
      ),
    [propiedades, motor, motorListo, indices, overrides, conOfertaVigente, conConversionPendiente],
  );

  const { agregadas, porUnidad } = useMemo(() => agregarAlertas(desgloses), [desgloses]);

  const totales = useMemo(() => {
    const totalCalculado = desgloses.reduce((a, d) => a + d.precio_lista, 0);
    const totalActual = propiedades.reduce((a, p) => a + p.precio_lista_actual, 0);
    const conAlertas = desgloses.filter((d) =>
      (porUnidad[d.id_propiedad] ?? []).some((a) => a.severidad !== "informativa"),
    ).length;
    const desviadas = desgloses.filter(
      (d) => d.alertas.some((a) => a.codigo === "DELTA_ALTO"),
    ).length;
    const bloqueadas = desgloses.filter((d) => d.bloqueada_para_reprecio).length;
    return {
      unidades: propiedades.length,
      totalCalculado,
      totalActual,
      delta: totalCalculado - totalActual,
      deltaPct: totalActual > 0 ? ((totalCalculado - totalActual) / totalActual) * 100 : 0,
      conAlertas,
      desviadas,
      bloqueadas,
    };
  }, [desgloses, propiedades, porUnidad]);

  return {
    motor,
    /** `false` mientras el motor del proyecto no se ha sembrado. */
    motorListo,
    conOfertaVigente,
    conConversionPendiente,
    propiedades,
    torresProyecto,
    modelosProyecto: inventario?.modelos ?? [],
    indices,
    desgloses,
    totales,
    alertasAgregadas: agregadas,
    alertasPorUnidad: porUnidad,
    /** El inventario del proyecto está en vuelo. */
    cargando,
    /** Ya se resolvió la carga, aunque haya venido vacía. */
    cargado,
  };
}
