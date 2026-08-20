import { useMotorStore } from "../stores/motorStore";
import { registrarEvento } from "../services/auditoria";
import type { AnclaProyecto, TipoFactor } from "../types/dominio";

const ETIQUETA_CAMPO: Record<string, string> = {
  precio_base_m2: "Precio base por m²",
  k_ext: "Factor de área exterior (k_ext)",
  k_loft: "Factor de área loft (k_loft)",
  precio_cajon: "Precio por cajón",
  factor_cajon_tandem: "Factor cajón en tándem",
  precio_m2_bodega: "Precio por m² de bodega",
  tasa_descuento_anual: "Tasa de descuento anual",
  vigencia_oferta_dias: "Vigencia de oferta (días)",
};

/**
 * Acciones del motor que dejan constancia en la bitácora.
 * La auditoría vive en el punto de llamada: el store no se reescribe.
 */
/** Cómo se nombra cada campo de la base de un modelo en la bitácora. */
const ETIQUETA_BASE: Record<"precio_base_m2" | "factor_modelo" | "m2_referencia", string> = {
  precio_base_m2: "Precio por m² resultante",
  factor_modelo: "Factor sobre el precio base del proyecto",
  m2_referencia: "M² de referencia",
};
export function useMotorAuditado() {
  const store = useMotorStore();

  const motorActual = () => useMotorStore.getState().getMotorActivo();

  const actualizarParametro = (campo: Parameters<typeof store.actualizarParametro>[0], valor: number) => {
    const antes = motorActual();
    if (antes[campo] === valor) return;
    store.actualizarParametro(campo, valor);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: antes.id_motor, etiqueta: ETIQUETA_CAMPO[campo] ?? campo },
      antes: antes[campo],
      despues: valor,
    });
  };

  const actualizarConfigNivel = (coef_a: number, coef_b: number) => {
    const antes = motorActual();
    if (antes.nivel.coef_a === coef_a && antes.nivel.coef_b === coef_b) return;
    store.actualizarConfigNivel(coef_a, coef_b);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: antes.id_motor, etiqueta: "Curva de nivel" },
      antes: { coef_a: antes.nivel.coef_a, coef_b: antes.nivel.coef_b },
      despues: { coef_a, coef_b },
    });
  };

  const actualizarConfigTamano = (theta: number) => {
    const antes = motorActual();
    if (antes.tamano.theta === theta) return;
    store.actualizarConfigTamano(theta);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.parametro_actualizado",
      entidad: { tipo: "motor", id: antes.id_motor, etiqueta: "Curva de tamaño" },
      antes: { theta: antes.tamano.theta },
      despues: { theta },
    });
  };

  /**
   * Precio por m² base del proyecto: el dato del que varía todo el desarrollo.
   * Se audita aparte de las bases por modelo porque mueve el inventario
   * completo de una sola vez.
   */
  const actualizarPrecioBaseProyecto = (valor: number) => {
    const antes = motorActual();
    if (antes.precio_base_m2_proyecto === valor) return;
    store.actualizarPrecioBaseProyecto(valor);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.parametro_actualizado",
      entidad: {
        tipo: "motor",
        id: antes.id_motor,
        etiqueta: "Precio por m² base del proyecto",
      },
      antes: { precio_base_m2_proyecto: antes.precio_base_m2_proyecto },
      despues: { precio_base_m2_proyecto: valor },
    });
  };
  const actualizarBaseModelo = (
    idModelo: string,
    campo: "precio_base_m2" | "factor_modelo" | "m2_referencia",
    valor: number,
  ) => {
    const antes = motorActual();
    const b = (antes.bases_modelo ?? []).find((x) => x.id_modelo === idModelo);
    if (!b || b[campo] === valor) return;
    store.actualizarBaseModelo(idModelo, campo, valor);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.parametro_actualizado",
      entidad: {
        tipo: "base_modelo",
        id: idModelo,
        etiqueta: `${b.nombre_modelo} · ${ETIQUETA_BASE[campo]}`,
      },
      antes: { [campo]: b[campo] },
      despues: { [campo]: valor },
    });
  };

  /**
   * Cambia el ancla del proyecto.
   *
   * Es neutral por construcción: `reanclarMotor` renormaliza las familias
   * contra las categorías nuevas y compensa los precios base, de modo que
   * ninguna unidad cambia de precio. Lo que sí cambia es qué SIGNIFICA el
   * precio base: pasa a ser el precio por m² en la combinación elegida.
   *
   * Por eso queda en bitácora con el base de antes y el de después: es la
   * única forma de explicar más tarde por qué el número se movió sin que se
   * moviera ningún precio.
   */
  const reanclar = (ancla: Omit<AnclaProyecto, "descripcion">) => {
    const antes = motorActual();
    const a = antes.ancla;
    if (
      a.id_torre === ancla.id_torre &&
      a.nivel === ancla.nivel &&
      a.clave_vista === ancla.clave_vista &&
      a.clave_orientacion === ancla.clave_orientacion
    ) {
      return;
    }
    store.setAncla(ancla);
    const despues = motorActual();
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.reanclado",
      entidad: { tipo: "motor", id: antes.id_motor, etiqueta: antes.nombre },
      antes: {
        ancla: a.descripcion,
        precio_base_m2_proyecto: antes.precio_base_m2_proyecto,
      },
      despues: {
        ancla: despues.ancla.descripcion,
        precio_base_m2_proyecto: despues.precio_base_m2_proyecto,
      },
    });
  };

  const declararCalibradoManualmente = (justificacion: string) => {
    const antes = motorActual();
    store.declararCalibradoManualmente(justificacion);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "calibracion.declarada_manualmente",
      entidad: { tipo: "motor", id: antes.id_motor, etiqueta: antes.nombre },
      antes: { estado_calibracion: antes.estado_calibracion },
      despues: { estado_calibracion: "calibrado_manualmente" },
      motivo: { causa: "declaracion_manual", descripcion: justificacion },
    });
  };

  const actualizarFactor = (idFactor: string, valor: number) => {
    const antes = motorActual();
    const f = antes.factores.find((x) => x.id_factor === idFactor);
    if (!f || f.valor === valor) return;
    store.actualizarFactor(idFactor, valor);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.factor_actualizado",
      entidad: {
        tipo: "factor",
        id: idFactor,
        etiqueta: `${f.tipo_factor} · ${f.etiqueta}`,
      },
      antes: f.valor,
      despues: valor,
    });
  };

  const agregarFactor = (
    tipo: TipoFactor,
    clave: string,
    etiqueta: string,
    valor: number,
  ) => {
    const antes = motorActual();
    store.agregarFactor(tipo, clave, etiqueta, valor);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.factor_creado",
      entidad: { tipo: "factor", id: clave, etiqueta: `${tipo} · ${etiqueta}` },
      antes: null,
      despues: { tipo_factor: tipo, clave, etiqueta, valor },
    });
  };

  const cambiarActivo = (idFactor: string, activo: boolean) => {
    const antes = motorActual();
    const f = antes.factores.find((x) => x.id_factor === idFactor);
    if (!f) return;
    if (activo) store.reactivarFactor(idFactor);
    else store.desactivarFactor(idFactor);
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: activo ? "motor.factor_reactivado" : "motor.factor_desactivado",
      entidad: {
        tipo: "factor",
        id: idFactor,
        etiqueta: `${f.tipo_factor} · ${f.etiqueta}`,
      },
      antes: { activo: f.activo, valor: f.valor },
      despues: { activo, valor: f.valor },
    });
  };

  const restablecer = () => {
    const antes = motorActual();
    store.reset();
    registrarEvento({
      id_proyecto: antes.id_proyecto,
      tipo: "motor.restablecido",
      entidad: { tipo: "motor", id: antes.id_motor, etiqueta: antes.nombre },
      antes: {
        precio_base_m2: antes.precio_base_m2,
        factores: antes.factores.length,
        estado_calibracion: antes.estado_calibracion,
      },
      despues: { restablecido: true },
    });
  };

  return {
    actualizarPrecioBaseProyecto,
    actualizarParametro,
    actualizarConfigNivel,
    actualizarConfigTamano,
    actualizarBaseModelo,
    reanclar,
    declararCalibradoManualmente,
    actualizarFactor,
    agregarFactor,
    cambiarActivo,
    restablecer,
  };
}
