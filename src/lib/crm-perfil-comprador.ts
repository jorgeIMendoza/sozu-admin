// Catálogos fijos del "Perfil del Comprador" (CRM > Negocios). Los valores (`value`)
// son códigos estables que se guardan en crm_negocios_perfil_comprador; `label` es lo que
// ve el asesor; `short` se usa en el badge condensado de la tarjeta del Kanban.

export type PerfilOpt = { value: string; label: string; short?: string };

// 1. Demográficos y composición
export const TIPO_ASISTENTE: PerfilOpt[] = [
  { value: "hombre_solo", label: "Hombre solo", short: "Hombre" },
  { value: "mujer_sola", label: "Mujer sola", short: "Mujer" },
  { value: "pareja", label: "Pareja joven / Matrimonio", short: "Pareja" },
  { value: "familia", label: "Familia", short: "Familia" },
  { value: "socios", label: "Socios / Inversionistas", short: "Socios" },
  { value: "mystery_shopper", label: "Mystery shopper", short: "Mystery" },
];

export const RANGO_EDAD: PerfilOpt[] = [
  { value: "menos_20", label: "Menos de 20", short: "<20" },
  { value: "20_30", label: "20 – 30 años", short: "20-30" },
  { value: "30_40", label: "30 – 40 años", short: "30-40" },
  { value: "40_50", label: "40 – 50 años", short: "40-50" },
  { value: "50_60", label: "50 – 60 años", short: "50-60" },
  { value: "60_mas", label: "60 o más", short: "60+" },
];

export const TOMA_DECISION: PerfilOpt[] = [
  { value: "individual", label: "Individual (decide solo/a)" },
  { value: "en_pareja", label: "En pareja" },
  { value: "aprobacion_familiar", label: "Requiere aprobación/apoyo familiar (padres/hijos)" },
  { value: "aprobacion_socio", label: "Requiere aprobación de socio" },
];

// 2. Intención y madurez de compra
export const INTENCION_USO: PerfilOpt[] = [
  { value: "full_inversionista", label: "Full inversionista (renta / Airbnb / plusvalía)", short: "Inversionista" },
  { value: "hibrido", label: "Híbrido (inversión con proyección a habitar)", short: "Híbrido" },
  { value: "full_vivienda", label: "Full vivienda (habitabilidad propia)", short: "Vivienda" },
];

export const EXPERIENCIA_PREVENTA: PerfilOpt[] = [
  { value: "primera_preventa", label: "Primera compra en preventa" },
  { value: "ya_compro_preventa", label: "Ya ha comprado en otros desarrollos en preventa" },
];

export const ETAPA_EXPLORACION: PerfilOpt[] = [
  { value: "primer_desarrollo", label: "Es el 1er desarrollo / showroom que visitan" },
  { value: "ya_visito_otras", label: "Ya han visitado otras opciones en la zona" },
];

// 4. Ventana temporal de decisión
export const PROYECCION_CIERRE: PerfilOpt[] = [
  { value: "inmediata", label: "Inmediata (mismo mes / < 15 días)", short: "Inmediata" },
  { value: "1_mes", label: "1 mes", short: "1 mes" },
  { value: "2_meses", label: "2 meses", short: "2 meses" },
  { value: "3_mas", label: "3 meses o más (largo plazo)", short: "3+ meses" },
];

// 3. Factores clave de la cita (multi-selección)
export const PUNTOS_POSITIVOS: PerfilOpt[] = [
  { value: "acabados", label: "Acabados / Departamento muestra" },
  { value: "solidez_grupo", label: "Solidez y prestigio del grupo" },
  { value: "certeza_juridica", label: "Certeza jurídica y legal" },
  { value: "financiamiento", label: "Plan de financiamiento / Esquema de enganche" },
  { value: "descuentos", label: "Descuentos comerciales" },
  { value: "precio", label: "Precio de la unidad" },
  { value: "amenidades", label: "Amenidades y áreas comunes" },
  { value: "orientacion_vistas", label: "Orientación solar / Vistas" },
  { value: "comparativa_favorable", label: "Comparación favorable vs. otros desarrollos" },
  { value: "ubicacion", label: "Ubicación / Colonia" },
  { value: "avance_obra", label: "Avance físico de obra / Columnas" },
  { value: "materiales", label: "Materiales y calidad de construcción" },
  { value: "distribucion", label: "Distribución del departamento (Layout)" },
  { value: "plazo_entrega", label: "Tiempo / Plazo de entrega" },
  { value: "estacionamiento_bodega", label: "Cajones de estacionamiento independientes / Bodegas" },
];

export const PUNTOS_NEGATIVOS: PerfilOpt[] = [
  { value: "neg_acabados", label: "Acabados / Materiales" },
  { value: "neg_grupo", label: "Dudas sobre el grupo / Respaldo" },
  { value: "neg_juridica", label: "Certeza jurídica / Cláusulas" },
  { value: "neg_financiamiento", label: "Esquema de financiamiento" },
  { value: "neg_descuento", label: "Descuento insuficiente" },
  { value: "neg_precio", label: "Precio rebasado para su presupuesto" },
  { value: "neg_amenidades", label: "Amenidades (tipos o escala)" },
  { value: "neg_orientacion", label: "Orientación solar / Vistas" },
  { value: "neg_comparativa", label: "Desventaja en comparativa de mercado" },
  { value: "neg_ubicacion", label: "Ubicación / Entorno" },
  { value: "neg_obra", label: "Ritmo / Estatus de la obra" },
  { value: "neg_distribucion", label: "Distribución de espacios (Layout)" },
  { value: "neg_plazo", label: "Tiempo / Plazo de entrega prolongado" },
  { value: "neg_contraentrega", label: "Monto elevado a la contra entrega" },
];

// Helpers de etiqueta
export const optLabel = (list: PerfilOpt[], v?: string | null): string | null =>
  (v && list.find((o) => o.value === v)?.label) || null;
export const optShort = (list: PerfilOpt[], v?: string | null): string | null => {
  const o = v ? list.find((x) => x.value === v) : undefined;
  return o ? (o.short ?? o.label) : null;
};

// Badge condensado para la tarjeta del Kanban: [tipo+edad] · [intención] · [ventana].
// Devuelve null si no hay ningún dato de perfil (para no pintar el badge).
export function perfilBadge(p: any): { tipoEdad: string; intencion: string | null; ventana: string | null } | null {
  if (!p) return null;
  const tipo = optShort(TIPO_ASISTENTE, p.tipo_asistente);
  const edad = optShort(RANGO_EDAD, p.rango_edad);
  const intencion = optShort(INTENCION_USO, p.intencion_uso);
  const ventana = optShort(PROYECCION_CIERRE, p.proyeccion_cierre);
  const tipoEdad = [tipo, edad].filter(Boolean).join(" ");
  if (!tipoEdad && !intencion && !ventana) return null;
  return { tipoEdad, intencion, ventana };
}
