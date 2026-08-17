/**
 * Datos mock (español mexicano). NADA se conecta a datos reales.
 * Cada acceso real deberá pasar por su // SWAP POINT: supabase.<tabla>
 */
import avatarColaborador from "@/assets/portal-personal/avatar-colaborador.jpg";
import daikuImg from "@/assets/portal-personal/daiku.jpg";
import monocoloImg from "@/assets/portal-personal/monocolo.jpg";
import margotImg from "@/assets/portal-personal/margot.jpg";
import botturaImg from "@/assets/portal-personal/bottura.jpg";
import interior1 from "@/assets/portal-personal/interior-1.jpg";
import interior2 from "@/assets/portal-personal/interior-2.jpg";

import type {
  ActivoPromocion,
  ComisionCanal,
  HitoPago,
  Auditoria,
  Campania,
  Desarrollo,
  EsquemaPago,
  Ganancia,
  LogAuditoria,
  MetaPersonal,
  Negocio,
  Referido,
  ReglasPrograma,
  Unidad,
  Usuario,
} from "./tipos";

export const IMAGENES_INTERIOR = [interior1, interior2];

const aud = (nota = "seed"): Auditoria => ({
  creado_en: "2026-01-15T10:00:00-06:00",
  creado_por: "sistema",
  actualizado_en: "2026-08-10T18:00:00-06:00",
  actualizado_por: nota,
  deprecado_en: null,
  deprecado_por: null,
  motivo: null,
});

// SWAP POINT: supabase.usuarios
export const USUARIO_ACTUAL: Usuario = {
  id: "usr-001",
  nombre: "José Ramón Escobar Martínez",
  foto_url: avatarColaborador,
  correo: "jr.escobar@sozu.mx",
  telefono: "+52 33 1284 5510",
  rol: "Coordinación de Experiencia",
  subrol: "Coordinador de Postventa",
  tipo_colaborador: "EMPLEADO_REV",
  elegible_referidos: true,
  motivo_inelegibilidad: null,
  codigo_referido: "JRE-4821",
  rfc: "EOMJ890412H23",
  curp: "EOMJ890412HJCSRN04",
  clabe: "012320004521879635",
  banco: "BBVA México",
  titular_clabe: "José Ramón Escobar Martínez",
  clabe_valida: true,
  reglas_aceptadas_version: null,
  conflicto_interes_firmado_en: null,
  cuenta_bancaria_confirmada: true,
  biografia:
    "Doce años acompañando a familias en su proceso de compra. Creo que una casa bien entregada vale más que cualquier promesa.",
  desarrollos_asignados: ["Daiku", "Monócolo", "Margot"],
  ultimo_acceso: "Hoy 8:37 p.m.",
  activacion_pct: 78,
  auditoria: aud(),
};

// SWAP POINT: supabase.usuarios (suplantación)
export const USUARIOS_SUPLANTABLES: Usuario[] = [
  USUARIO_ACTUAL,
  {
    ...USUARIO_ACTUAL,
    id: "usr-002",
    nombre: "María Fernanda Ruvalcaba Ortiz",
    foto_url: null,
    correo: "mf.ruvalcaba@investimento.mx",
    rol: "Administración de Obra",
    subrol: "Analista de Contratos",
    tipo_colaborador: "COLAB_INVESTIMENTO",
    codigo_referido: "MFR-2207",
    elegible_referidos: true,
    motivo_inelegibilidad: null,
    activacion_pct: 54,
  },
  {
    ...USUARIO_ACTUAL,
    id: "usr-003",
    nombre: "Luis Alberto Cárdenas Vega",
    foto_url: null,
    correo: "la.cardenas@tallwood.mx",
    rol: "Control de Inventario",
    subrol: "Jefe de Inventario de Unidades",
    tipo_colaborador: "PERSONAL_TALLWOOD",
    codigo_referido: "LAC-9012",
    elegible_referidos: false,
    motivo_inelegibilidad:
      "No elegible: tu rol participa en decisiones que crean conflicto de interés con el programa de referidos.",
    activacion_pct: 41,
  },
];

// SWAP POINT: supabase.desarrollos
export const DESARROLLOS: Desarrollo[] = [
  {
    id: "dev-daiku",
    slug: "daiku",
    nombre: "Daiku",
    direccion: "Av. Pablo Neruda 2825, Providencia, Guadalajara, Jal.",
    desarrollador: "Tallwood",
    comercializador: "REV (SOZU)",
    imagen: daikuImg,
    precio_desde: 4301188,
    total_unidades: 124,
    disponibles: 81,
    avance_obra: 46,
    entrega_estimada: "Q1 2028",
    auditoria: aud(),
  },
  {
    id: "dev-monocolo",
    slug: "monocolo",
    nombre: "Monócolo",
    direccion: "Calle Argentina 118, Col. Americana, Guadalajara, Jal.",
    desarrollador: "Tallwood",
    comercializador: "REV (SOZU)",
    imagen: monocoloImg,
    precio_desde: 3180500,
    total_unidades: 68,
    disponibles: 22,
    avance_obra: 72,
    entrega_estimada: "Q2 2027",
    auditoria: aud(),
  },
  {
    id: "dev-margot",
    slug: "margot",
    nombre: "Margot",
    direccion: "Av. Terranova 1045, Col. Vallarta Norte, Guadalajara, Jal.",
    desarrollador: "Tallwood",
    comercializador: "REV (SOZU)",
    imagen: margotImg,
    precio_desde: 5620900,
    total_unidades: 44,
    disponibles: 12,
    avance_obra: 88,
    entrega_estimada: "Q4 2026",
    auditoria: aud(),
  },
  {
    id: "dev-bottura",
    slug: "bottura",
    nombre: "Bottura",
    direccion: "Av. Acueducto 4851, Puerta de Hierro, Zapopan, Jal.",
    desarrollador: "Tallwood",
    comercializador: "REV (SOZU)",
    imagen: botturaImg,
    precio_desde: 6980000,
    total_unidades: 96,
    disponibles: 57,
    avance_obra: 24,
    entrega_estimada: "Q3 2029",
    auditoria: aud(),
  },
];

const MODELOS = [
  "PAROTA PLUS",
  "PAROTA",
  "CEIBA",
  "HUANACAXTLE",
  "TEPEHUAJE",
  "COLORÍN",
];

function generarUnidades(): Unidad[] {
  const unidades: Unidad[] = [];
  DESARROLLOS.forEach((dev, di) => {
    const cantidad = [12, 9, 7, 10][di]!;
    for (let i = 0; i < cantidad; i++) {
      const nivel = (i % 9) + 1;
      const numero = `${nivel}0${(i % 6) + 1}`;
      const modelo = MODELOS[(i + di) % MODELOS.length]!;
      const superficie = 58.4 + ((i * 7.3 + di * 5) % 46);
      const precio =
        dev.precio_desde + Math.round(((i * 137_000 + di * 41_000) % 2_400_000) / 100) * 100;
      const bodegas = i % 3 === 0 ? 1 : 0;
      const estacionamientos = (i % 2) + 1;
      unidades.push({
        id: `${dev.id}-u${numero}-${i}`,
        desarrollo_id: dev.id,
        numero,
        modelo,
        nivel,
        precio,
        libro: "IVA_EXENTO",
        superficie: Math.round(superficie * 10) / 10,
        recamaras: (i % 3) + 1,
        banos: (i % 2) + 1,
        bodegas,
        estacionamientos,
        tipo_estacionamiento: "Normal",
        disponible: i % 7 !== 0,
        imagenes: [IMAGENES_INTERIOR[i % 2]!, IMAGENES_INTERIOR[(i + 1) % 2]!, dev.imagen],
        productos_adicionales: [
          ...(bodegas
            ? [
                {
                  clave: `S0${nivel}-B0${(i % 8) + 1}`,
                  tipo: "BODEGA" as const,
                  monto: 143400,
                  libro: "IVA_GRAVADO" as const,
                },
              ]
            : []),
          {
            clave: `E0${nivel}-P${(i % 9) + 1}`,
            tipo: "ESTACIONAMIENTO" as const,
            monto: 385000,
            libro: "IVA_GRAVADO" as const,
          },
        ],
        auditoria: aud(),
      });
    }
  });
  return unidades;
}

// SWAP POINT: supabase.unidades
export const UNIDADES: Unidad[] = generarUnidades();

// SWAP POINT: supabase.esquemas_pago
export const ESQUEMAS_PAGO: EsquemaPago[] = UNIDADES.flatMap((u, i) => [
  {
    id: `${u.id}-esq-1`,
    unidad_id: u.id,
    nombre: "Preventa 34 meses",
    pct_enganche: 6,
    pct_mensualidades: 15.3,
    pct_entrega: 78.7,
    plazo_meses: 34,
  },
  {
    id: `${u.id}-esq-2`,
    unidad_id: u.id,
    nombre: "Enganche reforzado",
    pct_enganche: 20,
    pct_mensualidades: 20,
    pct_entrega: 60,
    plazo_meses: 24,
  },
  ...(i % 2 === 0
    ? [
        {
          id: `${u.id}-esq-3`,
          unidad_id: u.id,
          nombre: "Contado con descuento",
          pct_enganche: 100,
          pct_mensualidades: 0,
          pct_entrega: 0,
          plazo_meses: 1,
        },
      ]
    : []),
]);

// SWAP POINT: supabase.referidos
export const REFERIDOS: Referido[] = [
  {
    id: "ref-001",
    nombre: "Adriana Michelle Zepeda Lomelí",
    correo: "adriana.zepeda@correo.mx",
    telefono: "+52 33 2210 4471",
    tipo_persona: "FISICA",
    rfc: "ZELA920318QK3",
    curp: "ZELA920318MJCPMD07",
    origen: "LINK",
    desarrollos_interes: ["Daiku", "Margot"],
    estado: "con_compra",
    es_cliente: true,
    duplicado_crm: false,
    registro_original: null,
    confirmado_en: "2026-02-11T12:20:00-06:00",
    proteccion_hasta: "2026-05-12T12:20:00-06:00",
    ganancia_potencial: 96_420,
    actividad: [
      { tipo: "registro", fecha: "11 feb 2026 · 12:20", detalle: "Registro por tu link JRE-4821" },
      { tipo: "contacto", fecha: "12 feb 2026 · 09:05", detalle: "Primer contacto del asesor" },
      { tipo: "cita", fecha: "18 feb 2026 · 17:30", detalle: "Recorrido en showroom Daiku" },
      { tipo: "oferta", fecha: "24 feb 2026 · 11:00", detalle: "Oferta personalizada enviada" },
      { tipo: "contrato", fecha: "09 mar 2026 · 16:40", detalle: "Contrato firmado · Depto. 311" },
    ],
    auditoria: aud(),
  },
  {
    id: "ref-002",
    nombre: "Gerardo Isaac Villaseñor Prado",
    correo: "gi.villasenor@correo.mx",
    telefono: "+52 33 1877 6620",
    tipo_persona: "FISICA",
    rfc: "VIPG851102MT8",
    curp: "VIPG851102HJCLRR02",
    origen: "LINK",
    desarrollos_interes: ["Bottura"],
    estado: "en_seguimiento",
    es_cliente: false,
    duplicado_crm: false,
    registro_original: null,
    confirmado_en: "2026-06-02T10:15:00-06:00",
    proteccion_hasta: "2026-08-31T10:15:00-06:00",
    ganancia_potencial: 124_800,
    actividad: [
      { tipo: "registro", fecha: "02 jun 2026 · 10:15", detalle: "Registro por tu link JRE-4821" },
      { tipo: "contacto", fecha: "03 jun 2026 · 13:22", detalle: "Llamada de calificación" },
      { tipo: "cita", fecha: "21 jun 2026 · 11:00", detalle: "Visita a obra Bottura" },
    ],
    auditoria: aud(),
  },
  {
    id: "ref-003",
    nombre: "Rocío Guadalupe Iñiguez Ávalos",
    correo: "rocio.iniguez@correo.mx",
    telefono: "+52 33 3390 1188",
    tipo_persona: "FISICA",
    rfc: null,
    curp: null,
    origen: "MANUAL",
    desarrollos_interes: ["Monócolo"],
    estado: "pendiente_confirmacion",
    es_cliente: false,
    duplicado_crm: false,
    registro_original: null,
    confirmado_en: null,
    proteccion_hasta: null,
    ganancia_potencial: 0,
    actividad: [
      { tipo: "registro", fecha: "05 ago 2026 · 19:44", detalle: "Captura manual · doble opt-in enviado" },
    ],
    auditoria: aud(),
  },
  {
    id: "ref-004",
    nombre: "Constructora Peñaflor S.A. de C.V.",
    correo: "contacto@penaflor.mx",
    telefono: "+52 33 3612 0044",
    tipo_persona: "MORAL",
    rfc: "CPE180722JT1",
    curp: null,
    origen: "MANUAL",
    desarrollos_interes: ["Daiku", "Bottura"],
    estado: "pendiente_confirmacion",
    es_cliente: false,
    duplicado_crm: true,
    registro_original: "14 ene 2026",
    confirmado_en: null,
    proteccion_hasta: null,
    ganancia_potencial: 0,
    actividad: [
      { tipo: "registro", fecha: "08 ago 2026 · 08:12", detalle: "Captura manual · duplicado detectado en CRM" },
    ],
    auditoria: aud(),
  },
  {
    id: "ref-005",
    nombre: "Paulina Estefanía Robles Cházaro",
    correo: "pe.robles@correo.mx",
    telefono: "+52 33 1502 7799",
    tipo_persona: "FISICA",
    rfc: "ROCP941230LM2",
    curp: "ROCP941230MJCBHL08",
    origen: "LINK",
    desarrollos_interes: ["Margot"],
    estado: "confirmado",
    es_cliente: false,
    duplicado_crm: false,
    registro_original: null,
    confirmado_en: "2026-07-28T20:02:00-06:00",
    proteccion_hasta: "2026-10-26T20:02:00-06:00",
    ganancia_potencial: 87_300,
    actividad: [
      { tipo: "registro", fecha: "28 jul 2026 · 20:02", detalle: "Registro por tu link JRE-4821" },
      { tipo: "contacto", fecha: "29 jul 2026 · 10:41", detalle: "Contacto inicial por WhatsApp" },
    ],
    auditoria: aud(),
  },
];

// SWAP POINT: supabase.negocios
export const NEGOCIOS: Negocio[] = [
  {
    id: "neg-001",
    desarrollo_id: "dev-daiku",
    unidad_label: "311 · CC-001836",
    folio: "CC-001836",
    tipo: "Propiedad",
    referido_id: "ref-001",
    etapa: "escriturado",
    valor: 5_428_881.3,
    ganancia_estimada: 96_420,
    cobro_estimado: "Q4 2026",
    razon_cierre: null,
    auditoria: aud(),
  },
  {
    id: "neg-002",
    desarrollo_id: "dev-bottura",
    unidad_label: "904 · CC-002011",
    folio: "CC-002011",
    tipo: "Propiedad",
    referido_id: "ref-002",
    etapa: "apartado_pagado",
    valor: 7_812_400,
    ganancia_estimada: 124_800,
    cobro_estimado: "Q3 2029",
    razon_cierre: null,
    auditoria: aud(),
  },
  {
    id: "neg-003",
    desarrollo_id: "dev-margot",
    unidad_label: "402 · CC-001990",
    folio: "CC-001990",
    tipo: "Propiedad",
    referido_id: "ref-005",
    etapa: "oferta_enviada",
    valor: 5_812_000,
    ganancia_estimada: 87_300,
    cobro_estimado: "Q1 2027",
    razon_cierre: null,
    auditoria: aud(),
  },
  {
    id: "neg-004",
    desarrollo_id: "dev-monocolo",
    unidad_label: "205 · CC-001744",
    folio: "CC-001744",
    tipo: "Propiedad",
    referido_id: "ref-003",
    etapa: "cierre_perdido",
    valor: 3_420_000,
    ganancia_estimada: 0,
    cobro_estimado: "—",
    razon_cierre: null,
    auditoria: aud(),
  },
  {
    id: "neg-005",
    desarrollo_id: "dev-daiku",
    unidad_label: "S03-B04 · CC-001861",
    folio: "CC-001861",
    tipo: "Producto adicional",
    referido_id: "ref-001",
    etapa: "escriturado",
    valor: 143_400,
    ganancia_estimada: 2_868,
    cobro_estimado: "Q4 2026",
    razon_cierre: null,
    auditoria: aud(),
  },
  {
    id: "neg-006",
    desarrollo_id: "dev-bottura",
    unidad_label: "706 · CC-002044",
    folio: "CC-002044",
    tipo: "Propiedad",
    referido_id: "ref-002",
    etapa: "cierre_perdido",
    valor: 6_980_000,
    ganancia_estimada: 0,
    cobro_estimado: "—",
    razon_cierre: null,
    auditoria: aud(),
  },
  {
    id: "neg-007",
    desarrollo_id: "dev-margot",
    unidad_label: "108 · CC-001902",
    folio: "CC-001902",
    tipo: "Propiedad",
    referido_id: "ref-005",
    etapa: "cierre_perdido",
    valor: 5_620_900,
    ganancia_estimada: 0,
    cobro_estimado: "—",
    razon_cierre: null,
    auditoria: aud(),
  },
];

// SWAP POINT: supabase.ganancias — conciliacion_stp determina el estatus
export const GANANCIAS: Ganancia[] = [
  {
    id: "gan-001",
    folio: "CCP-001822",
    desarrollo_id: "dev-daiku",
    unidad_label: "Depto. 311",
    referido_id: "ref-001",
    compradores: 2,
    venta: 5_428_881.3,
    neto: 96_420,
    bruto: 108_577.62,
    retenciones: 12_157.62,
    clave_sat: "038",
    vehiculo_pago: "BONO_NOMINA_038",
    libro: "IVA_EXENTO",
    estatus: "depositado",
    fecha_pago: "12 jul 2026",
    auditoria: aud(),
  },
  {
    id: "gan-002",
    folio: "CCP-001861",
    desarrollo_id: "dev-daiku",
    unidad_label: "S03-B04",
    referido_id: "ref-001",
    compradores: 1,
    venta: 143_400,
    neto: 2_868,
    bruto: 3_229.5,
    retenciones: 361.5,
    clave_sat: "038",
    vehiculo_pago: "BONO_NOMINA_038",
    libro: "IVA_GRAVADO",
    estatus: "aprobado",
    fecha_pago: "Estimado 30 sep 2026",
    auditoria: aud(),
  },
];

// SWAP POINT: supabase.metas_personales
export const META: MetaPersonal = {
  id: "meta-001",
  usuario_id: "usr-001",
  objetivo_referidos: 5,
  logrados: 3,
  periodo: "2026",
};

// SWAP POINT: supabase.campanias
export const CAMPANIA_VIGENTE: Campania = {
  id: "cmp-2026-01",
  nombre: "Campaña Referidos 2026",
  vigencia_inicio: "01 ene 2026",
  vigencia_fin: "31 dic 2026",
  pct_comision: 0.02,
};

// SWAP POINT: supabase.reglas_programa
export const REGLAS: ReglasPrograma = {
  version: "1.0",
  vigente_desde: "01 de enero de 2026",
  secciones: [
    {
      titulo: "Quién puede participar",
      cuerpo: [
        "Puede participar el personal de REV (SOZU), Investimento y Tallwood que cuente con expediente activo, cuenta bancaria confirmada a su nombre y la Declaración de Conflicto de Interés firmada.",
        "La participación es voluntaria y no forma parte de las funciones ordinarias del puesto.",
      ],
    },
    {
      titulo: "Quién queda excluido y por qué",
      cuerpo: [
        "Queda excluido quien autoriza o modifica precios; quien aprueba créditos o financiamiento; quien audita o lleva la contabilidad; quien controla el inventario de unidades; y quien firma o aprueba ofertas.",
        "La exclusión evita que una misma persona influya en la decisión comercial y a la vez obtenga un beneficio económico por ella.",
      ],
    },
    {
      titulo: "Cómo se registra un referido",
      cuerpo: [
        "El camino primario es el link con código único: la persona se registra por sí misma y otorga su consentimiento directamente.",
        "La captura manual es el camino secundario y requiere doble opt-in: el referido no queda activo hasta que confirma sus datos.",
        "Si el prospecto ya existía en el CRM, el registro no genera atribución.",
      ],
    },
    {
      titulo: "Periodo de protección",
      cuerpo: [
        "La atribución se protege por 90 días naturales contados desde la confirmación del referido.",
        "Las disputas se resuelven a favor del primer registro confirmado, según el sello de tiempo del registro append-only.",
      ],
    },
    {
      titulo: "Cuándo se genera el derecho al pago",
      cuerpo: [
        "El derecho se devenga con la escrituración de la unidad y el pago del cliente confirmado por conciliación automática de la CLABE STP.",
        "El apartado no genera derecho al pago.",
      ],
    },
    {
      titulo: "Cómo y cuándo se paga",
      cuerpo: [
        "El pago se deposita a la cuenta bancaria registrada a nombre del participante, cuyo titular debe coincidir con el RFC declarado.",
        "El estatus de pago avanza automáticamente conforme el backend concilia la operación. Ninguna persona puede marcar un pago como recibido.",
      ],
    },
  ],
};

// SWAP POINT: supabase.activos_promocion
export const ACTIVOS: ActivoPromocion[] = DESARROLLOS.flatMap((dev) => [
  {
    id: `${dev.id}-act-1`,
    desarrollo_id: dev.id,
    tipo: "IMAGEN",
    nombre: `Render fachada ${dev.nombre}`,
    miniatura: dev.imagen,
    aprobado_por: "Mercadotecnia SOZU",
    aprobado_en: "12 may 2026",
    auditoria: aud(),
  },
  {
    id: `${dev.id}-act-2`,
    desarrollo_id: dev.id,
    tipo: "IMAGEN",
    nombre: `Interiores ${dev.nombre}`,
    miniatura: IMAGENES_INTERIOR[0]!,
    aprobado_por: "Mercadotecnia SOZU",
    aprobado_en: "12 may 2026",
    auditoria: aud(),
  },
  {
    id: `${dev.id}-act-3`,
    desarrollo_id: dev.id,
    tipo: "TEXTO",
    nombre: "Mensaje corto para WhatsApp",
    copy: `${dev.nombre} tiene ${dev.disponibles} departamentos disponibles en ${dev.direccion.split(",")[1]?.trim() ?? "Guadalajara"}. Entrega estimada ${dev.entrega_estimada}. Si quieres conocer los modelos y precios, déjanos tus datos aquí:`,
    aprobado_por: "Jurídico + Mercadotecnia SOZU",
    aprobado_en: "12 may 2026",
    auditoria: aud(),
  },
  {
    id: `${dev.id}-act-4`,
    desarrollo_id: dev.id,
    tipo: "TEXTO",
    nombre: "Publicación para redes",
    copy: `Así avanza ${dev.nombre}: ${dev.avance_obra}% de obra y departamentos desde $${dev.precio_desde.toLocaleString("es-MX")} MXN. Recibe la información oficial y una oferta personalizada:`,
    aprobado_por: "Jurídico + Mercadotecnia SOZU",
    aprobado_en: "12 may 2026",
    auditoria: aud(),
  },
  {
    id: `${dev.id}-act-5`,
    desarrollo_id: dev.id,
    tipo: "PDF",
    nombre: `Ficha técnica ${dev.nombre}.pdf`,
    tamano: "2.4 MB",
    aprobado_por: "Mercadotecnia SOZU",
    aprobado_en: "12 may 2026",
    auditoria: aud(),
  },
  {
    id: `${dev.id}-act-6`,
    desarrollo_id: dev.id,
    tipo: "VIDEO",
    nombre: `Recorrido virtual ${dev.nombre}`,
    miniatura: IMAGENES_INTERIOR[1]!,
    url: `https://sozu.com/recorridos/${dev.slug}`,
    aprobado_por: "Mercadotecnia SOZU",
    aprobado_en: "12 may 2026",
    auditoria: aud(),
  },
]);

// SWAP POINT: supabase.logs_auditoria (append-only)
export const LOGS_INICIALES: LogAuditoria[] = [
  {
    id: "log-001",
    fecha: "11 feb 2026 · 12:20",
    usuario_id: "usr-001",
    accion: "alta_referido",
    detalle: "Alta por link · ref-001",
    hash_previo: null,
  },
];

/**
 * SWAP POINT: supabase.vw_mi_comision_por_canal
 * NOTA PARA JORGE: esta vista no existe todavía. Requiere (1) RLS activa en las
 * tablas del motor de comisiones y en la tabla de personal/sueldos, y (2) creación
 * de la vista con SECURITY INVOKER filtrada por auth.uid(). Hasta entonces el
 * módulo opera con datos mock. No conectar sin tu firma.
 *
 * La vista devuelve únicamente: canal_id, canal_nombre, mi_porcentaje,
 * aplica_a_referido_directo, aplica_a_participacion_canal.
 */
export const MI_COMISION_POR_CANAL: ComisionCanal[] = [
  {
    canal_id: "referido-directo",
    canal_nombre: "Referido directo con tu link",
    mi_porcentaje: CAMPANIA_VIGENTE.pct_comision,
    aplica_a_referido_directo: true,
    aplica_a_participacion_canal: false,
  },
  {
    canal_id: "walk-in",
    canal_nombre: "Walk-in",
    mi_porcentaje: 0.00085,
    aplica_a_referido_directo: false,
    aplica_a_participacion_canal: true,
  },
  {
    canal_id: "agente-independiente",
    canal_nombre: "Agente Independiente",
    mi_porcentaje: 0.0004,
    aplica_a_referido_directo: false,
    aplica_a_participacion_canal: true,
  },
  {
    canal_id: "embajador",
    canal_nombre: "Embajador",
    mi_porcentaje: 0.00052,
    aplica_a_referido_directo: false,
    aplica_a_participacion_canal: true,
  },
  {
    canal_id: "socio",
    canal_nombre: "Socio",
    mi_porcentaje: 0.00031,
    aplica_a_referido_directo: false,
    aplica_a_participacion_canal: true,
  },
  {
    canal_id: "canal-inbound",
    canal_nombre: "Canal Inbound",
    mi_porcentaje: 0.00068,
    aplica_a_referido_directo: false,
    aplica_a_participacion_canal: true,
  },
  {
    canal_id: "inmobiliaria",
    canal_nombre: "Inmobiliaria",
    mi_porcentaje: 0.00025,
    aplica_a_referido_directo: false,
    aplica_a_participacion_canal: true,
  },
];

/**
 * SWAP POINT: supabase.reglas_programa.hitos_pago
 * Hoy un solo hito. Cuando Dirección apruebe un anticipo se agregan hitos
 * al arreglo sin rehacer el componente de línea de tiempo.
 */
export const HITOS_PAGO: Omit<HitoPago, "fecha_estimada">[] = [
  {
    concepto: "Bono completo",
    porcentaje: 100,
    evento_disparador: "escrituracion_con_pago_conciliado",
  },
];

/** SWAP POINT: supabase.expediente_secciones */
export const EXPEDIENTE = {
  secciones_totales: 6,
  validadas: 4,
  en_proceso: 2,
  pendientes: 0,
};
