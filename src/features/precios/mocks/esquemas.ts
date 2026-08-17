import type { EsquemaFinanciamiento } from "../types/dominio";

/** Base común de un esquema; los mocks solo declaran lo que difiere. */
function esquema(
  idProyecto: string,
  id: string,
  nombre: string,
  datos: Partial<EsquemaFinanciamiento>,
): EsquemaFinanciamiento {
  return {
    id_esquema: id,
    id_proyecto: idProyecto,
    nombre,
    tipo_esquema: "preventa",
    pct_enganche: 0,
    pct_mensualidades: 0,
    pct_entrega: 0,
    num_mensualidades: 0,
    escalonadas: false,
    modo_escalonamiento: "lineal",
    tramos: [{ peso: 0.2 }, { peso: 0.3 }, { peso: 0.5 }],
    factor_crecimiento: 0.05,
    meses_enganche: 1,
    mes_inicio_mensualidades: 1,
    pct_ajuste_manual: 0,
    es_base: false,
    es_contado: false,
    activo: true,
    creado_en: "2026-08-15T00:00:00.000Z",
    ...datos,
  };
}

const DAIKU: EsquemaFinanciamiento[] = [
  esquema("pry-daiku", "esq-dk-contado", "Contado", {
    pct_enganche: 1,
    mes_inicio_mensualidades: 0,
    pct_ajuste_manual: -0.06,
    es_contado: true,
  }),
  esquema("pry-daiku", "esq-dk-30-40-30", "Esquema 30-40-30", {
    pct_enganche: 0.3,
    pct_mensualidades: 0.4,
    pct_entrega: 0.3,
    num_mensualidades: 10,
    es_base: true,
  }),
  esquema("pry-daiku", "esq-dk-20-30-50", "Esquema 20-30-50", {
    pct_enganche: 0.2,
    pct_mensualidades: 0.3,
    pct_entrega: 0.5,
    num_mensualidades: 10,
    pct_ajuste_manual: 0.015,
  }),
  esquema("pry-daiku", "esq-dk-50-20-30", "Esquema 50-20-30", {
    pct_enganche: 0.5,
    pct_mensualidades: 0.2,
    pct_entrega: 0.3,
    num_mensualidades: 6,
    pct_ajuste_manual: -0.05,
  }),
  esquema("pry-daiku", "esq-dk-10-40-50", "Esquema 10-40-50", {
    pct_enganche: 0.1,
    pct_mensualidades: 0.4,
    pct_entrega: 0.5,
    num_mensualidades: 10,
    pct_ajuste_manual: 0.02,
  }),
  esquema("pry-daiku", "esq-dk-20-40-40-24", "Esquema 20-40-40 a 24 meses", {
    pct_enganche: 0.2,
    pct_mensualidades: 0.4,
    pct_entrega: 0.4,
    num_mensualidades: 24,
  }),
  esquema("pry-daiku", "esq-dk-post-contado", "Contado post-entrega", {
    tipo_esquema: "post_entrega",
    pct_enganche: 1,
    mes_inicio_mensualidades: 0,
    pct_ajuste_manual: -0.04,
    es_contado: true,
  }),
  esquema("pry-daiku", "esq-dk-post-30-70", "Post-entrega 30-70 a 6 meses", {
    tipo_esquema: "post_entrega",
    pct_enganche: 0.3,
    pct_mensualidades: 0.7,
    pct_entrega: 0,
    num_mensualidades: 6,
    pct_ajuste_manual: 0.01,
  }),
];

const MONOCOLO: EsquemaFinanciamiento[] = [
  esquema("pry-monocolo", "esq-mc-contado", "Contado", {
    pct_enganche: 1,
    mes_inicio_mensualidades: 0,
    pct_ajuste_manual: -0.08,
    es_contado: true,
  }),
  esquema("pry-monocolo", "esq-mc-20-40-40", "Esquema 20-40-40", {
    pct_enganche: 0.2,
    pct_mensualidades: 0.4,
    pct_entrega: 0.4,
    num_mensualidades: 18,
    es_base: true,
  }),
  esquema("pry-monocolo", "esq-mc-15-35-50", "Esquema 15-35-50 escalonado", {
    pct_enganche: 0.15,
    pct_mensualidades: 0.35,
    pct_entrega: 0.5,
    num_mensualidades: 18,
    escalonadas: true,
    modo_escalonamiento: "tramos",
    tramos: [{ peso: 0.2 }, { peso: 0.3 }, { peso: 0.5 }],
    pct_ajuste_manual: 0.02,
  }),
  esquema("pry-monocolo", "esq-mc-40-20-40", "Esquema 40-20-40", {
    pct_enganche: 0.4,
    pct_mensualidades: 0.2,
    pct_entrega: 0.4,
    num_mensualidades: 12,
    pct_ajuste_manual: -0.04,
  }),
];

export const ESQUEMAS_SEMILLA: Record<string, EsquemaFinanciamiento[]> = {
  "pry-daiku": DAIKU,
  "pry-monocolo": MONOCOLO,
};
