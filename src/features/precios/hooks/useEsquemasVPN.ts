import { useMemo } from "react";
import { estatusBloqueaReprecio } from "../engine/pricing";
import { MOTOR_VACIO } from "../engine/semilla";
import {
  calcularVPN,
  calcularVPNPorTorre,
  esInejecutable,
  factorPonderado,
  horizonteEfectivo,
  horizonteMeses,
  tasaMensual,
} from "../engine/npv";
import { useInventarioStore } from "../stores/inventarioStore";
import { useMotorStore } from "../stores/motorStore";
import { useEsquemasStore } from "../stores/esquemasStore";
import type { EsquemaFinanciamiento, ResultadoVPN, Torre } from "../types/dominio";


export interface VpnPorTorre {
  porTorre: Record<string, ResultadoVPN>;
  ponderado: number;
  parcial: boolean;
}

/**
 * Resuelve los esquemas del proyecto activo y su valor presente.
 * El horizonte se calcula por torre: el mismo esquema vale distinto en cada
 * torre porque el pago contra entrega cae en meses diferentes.
 */
export function useEsquemasVPN() {
  const idProyecto = useMotorStore((s) => s.idProyectoActivo);
  const motor = useMotorStore((s) => s.motoresPorProyecto[s.idProyectoActivo]) ?? MOTOR_VACIO;
  const esquemasPorProyecto = useEsquemasStore((s) => s.esquemasPorProyecto);
  const porProyecto = useInventarioStore((s) => s.porProyecto);
  const inventario = porProyecto[idProyecto];

  const esquemas = useMemo(
    () => esquemasPorProyecto[idProyecto] ?? [],
    [esquemasPorProyecto, idProyecto],
  );

  const torres = useMemo(
    () => (inventario?.torres ?? []).filter((t) => t.activo),
    [inventario],
  );

  const holgura = motor.meses_holgura_entrega ?? 0;

  const horizontes = useMemo(
    () =>
      torres.map((t) => ({
        torre: t,
        meses: horizonteMeses(t.fecha_entrega_estimada, holgura),
      })),
    [torres, holgura],
  );

  const unidadesPorTorre = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const t of torres) mapa[t.id_torre] = 0;
    for (const p of inventario?.propiedades ?? []) {
      if (!p.activo) continue;
      if (estatusBloqueaReprecio(p.estatus)) continue;
      mapa[p.id_torre] = (mapa[p.id_torre] ?? 0) + 1;
    }
    return mapa;
  }, [torres, inventario]);

  const minimo = horizontes.reduce(
    (a, h) => (h.meses < a.meses ? h : a),
    horizontes[0] ?? { torre: null as Torre | null, meses: 12 },
  );
  const maximo = horizontes.reduce((a, h) => Math.max(a, h.meses), 0);

  /**
   * El esquema base es uno por régimen. Un esquema de preventa se compara
   * contra la base de preventa, y uno de post-entrega contra la suya. Compararlos
   * contra una sola base mezcla dos calendarios distintos y produce brechas
   * con el signo equivocado.
   */
  const basePorRegimen = useMemo(() => {
    const mapa: Record<string, EsquemaFinanciamiento | null> = {
      preventa: null,
      post_entrega: null,
    };
    for (const e of esquemas) {
      if (e.es_base && e.activo) mapa[e.tipo_esquema] = e;
    }
    return mapa;
  }, [esquemas]);

  const baseDe = (e: EsquemaFinanciamiento) => basePorRegimen[e.tipo_esquema] ?? null;

  const base = basePorRegimen["preventa"] ?? basePorRegimen["post_entrega"] ?? null;

  /** Resultado por torre de cada esquema. */
  const porTorre = useMemo(() => {
    const mapa: Record<string, VpnPorTorre> = {};
    for (const e of esquemas) {
      const r = calcularVPNPorTorre(
        e,
        torres,
        motor.tasa_descuento_anual,
        holgura,
        baseDe(e),
        motor.vpn_objetivo_factor ?? null,
      );
      const { factor, parcial } = factorPonderado(r, unidadesPorTorre);
      mapa[e.id_esquema] = { porTorre: r, ponderado: factor, parcial };
    }
    return mapa;
  }, [
    esquemas,
    torres,
    holgura,
    motor.tasa_descuento_anual,
    motor.vpn_objetivo_factor,
    basePorRegimen,
    unidadesPorTorre,
  ]);

  /**
   * Resultado único de proyecto, evaluado en la torre de entrega más próxima
   * (la más restrictiva para el calendario). Se conserva para las superficies
   * que necesitan un solo número.
   */
  const resultados = useMemo(() => {
    const mapa: Record<string, ResultadoVPN> = {};
    for (const e of esquemas) {
      mapa[e.id_esquema] = calcularVPN(
        e,
        horizonteEfectivo(e, minimo.meses),
        motor.tasa_descuento_anual,
        baseDe(e),
        motor.vpn_objetivo_factor ?? null,
        {
          nombreTorre: minimo.torre?.nombre,
          horizonteMinimo: minimo.meses,
        },
      );
    }
    return mapa;
  }, [
    esquemas,
    minimo.meses,
    minimo.torre?.nombre,
    motor.tasa_descuento_anual,
    motor.vpn_objetivo_factor,
    basePorRegimen,
  ]);

  /** Factor de VPN de un esquema en una torre concreta, con respaldo al ponderado. */
  const factorEnTorre = (idEsquema: string, idTorre: string | null): number => {
    const bloque = porTorre[idEsquema];
    if (!bloque) return resultados[idEsquema]?.factor_vpn ?? 0;
    if (idTorre && bloque.porTorre[idTorre]) return bloque.porTorre[idTorre]!.factor_vpn;
    return bloque.ponderado;
  };

  return {
    idProyecto,
    motor,
    esquemas,
    esquemaBase: base,
    basePorRegimen,
    resultados,
    porTorre,
    factorEnTorre,
    unidadesPorTorre,
    torres,
    multiTorre: torres.length > 1,
    horizonte: minimo.meses,
    horizonteMinimo: minimo.meses,
    horizonteMaximo: maximo,
    horizontesPorTorre: horizontes,
    tasaAnual: motor.tasa_descuento_anual,
    tasaMes: tasaMensual(motor.tasa_descuento_anual),
    esInejecutable,
  };
}

export type EsquemaConVPN = { esquema: EsquemaFinanciamiento; vpn: ResultadoVPN };
