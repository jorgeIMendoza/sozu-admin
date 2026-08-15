import { useEffect, useMemo, useRef } from "react";
import { agregarAlertas, calcularLote } from "../engine/pricing";
import {
  MODELOS_POR_ID,
  PROPIEDADES,
  PROPIEDADES_POR_ID,
  TORRES,
  TORRES_POR_ID,
} from "../mocks/inventario";
import { useMotorStore } from "../stores/motorStore";
import { useListaStore } from "../stores/listaStore";
import {
  idsConConversionPendiente,
  idsConOfertaVigente,
  useOfertasStore,
} from "../stores/ofertasStore";
import { registrarEvento } from "../services/auditoria";

/**
 * Calcula el desglose de precios del proyecto activo con el motor vigente.
 * SWAP POINT: aquí se leerá el inventario real desde Lovable Cloud.
 */
export function usePreciosProyecto() {
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);
  const motoresPorProyecto = useMotorStore((s) => s.motoresPorProyecto);
  const overrides = useListaStore((s) => s.overrides);
  const ofertas = useOfertasStore((s) => s.ofertas);
  const recalcularVencimientos = useOfertasStore((s) => s.recalcularVencimientos);

  const motor = motoresPorProyecto[idProyectoActivo]!;

  // SWAP POINT: en producción esto corre como tarea programada del lado del servidor, no al montar el cliente.
  const yaRecalculado = useRef(false);
  useEffect(() => {
    if (yaRecalculado.current) return;
    yaRecalculado.current = true;
    const vencidas = recalcularVencimientos();
    for (const o of vencidas) {
      registrarEvento({
        id_proyecto: o.id_proyecto,
        tipo: "oferta.vencida",
        entidad: {
          tipo: "oferta",
          id: o.id_oferta,
          etiqueta: `Unidad ${PROPIEDADES_POR_ID[o.id_propiedad]?.numero ?? o.id_propiedad}`,
        },
        antes: { estado: "vigente", vence_en: o.vence_en },
        despues: { estado: "vencida" },
        ocurrido_en: o.vence_en,
      });
    }
  }, [recalcularVencimientos]);

  const conOfertaVigente = useMemo(
    () => idsConOfertaVigente(ofertas, idProyectoActivo),
    [ofertas, idProyectoActivo],
  );

  const conConversionPendiente = useMemo(
    () =>
      idsConConversionPendiente(
        ofertas,
        idProyectoActivo,
        (id) => PROPIEDADES_POR_ID[id]?.estatus,
      ),
    [ofertas, idProyectoActivo],
  );

  const propiedades = useMemo(
    () => PROPIEDADES.filter((p) => p.activo && p.id_proyecto === idProyectoActivo),
    [idProyectoActivo],
  );

  const torresProyecto = useMemo(
    () => TORRES.filter((t) => t.id_proyecto === idProyectoActivo),
    [idProyectoActivo],
  );

  const desgloses = useMemo(
    () =>
      calcularLote(
        propiedades,
        {
          modelos: MODELOS_POR_ID,
          torres: TORRES_POR_ID,
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
    [propiedades, motor, overrides, conOfertaVigente, conConversionPendiente],
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
    conOfertaVigente,
    conConversionPendiente,
    propiedades,
    torresProyecto,
    desgloses,
    totales,
    alertasAgregadas: agregadas,
    alertasPorUnidad: porUnidad,
  };
}
