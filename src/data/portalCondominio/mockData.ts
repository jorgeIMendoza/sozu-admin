// Mock data — Portal Condominio Administración
// Inspirado en "Sozu Margot Operations Hub". 100% mock, no persiste.

export interface Unidad {
  id: string;
  numero: string;
  piso: number;
  edificio: string;
  tipo: string;
  area_m2: number;
  estatus: "ocupado" | "vacante" | "renta_corta" | "mantenimiento";
  propietario: string;
  residente: string;
  clabe: string;
  referencia_pago: string;
  saldo_actual: number;
  saldo_vencido: number;
  ultimo_pago: string | null;
  cuota_mensual: number;
}

export interface Cargo {
  id: string;
  unidad_id: string;
  unidad_numero: string;
  concepto: string;
  categoria: "mantenimiento" | "multa" | "extraordinario" | "amenidad";
  monto: number;
  fecha_generacion: string;
  fecha_vencimiento: string;
  estatus: "pendiente" | "pagado" | "parcial" | "vencido" | "cancelado";
  notas: string;
  creado_por: string;
}

export interface Pago {
  id: string;
  unidad_id: string;
  unidad_numero: string;
  monto: number;
  fecha: string;
  cuenta_origen: string;
  clabe_destino: string;
  referencia: string;
  concepto: string;
  estatus_conciliacion: "conciliado" | "excepcion" | "pendiente" | "manual";
  nota_conciliacion?: string;
}

export interface Egreso {
  id: string;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: string;
  proveedor: string;
  estatus: "pagado" | "pendiente" | "programado";
  notas: string;
}

export interface Amenidad {
  id: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  costo: number;
  reglas: string;
  estatus: "disponible" | "mantenimiento" | "reservado";
}

export interface Reserva {
  id: string;
  amenidad_id: string;
  amenidad_nombre: string;
  unidad_numero: string;
  residente: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estatus: "solicitada" | "aprobada" | "rechazada" | "completada" | "cancelada";
  costo: number;
  notas: string;
}

export interface AccionCobranza {
  id: string;
  unidad_id: string;
  unidad_numero: string;
  propietario: string;
  monto_vencido: number;
  antiguedad: "1-30" | "31-60" | "61-90" | "90+";
  ultimo_pago: string | null;
  tipo_accion: "llamada" | "mensaje" | "promesa_pago" | "convenio" | "nota";
  fecha_accion: string;
  fecha_promesa: string | null;
  estatus_promesa: "pendiente" | "cumplida" | "incumplida" | null;
  notas: string;
  agente: string;
}

const nombres = ["Carlos","María","José","Ana","Roberto","Laura","Miguel","Patricia","Fernando","Gabriela","Luis","Sofía","Alejandro","Valentina","Diego","Camila","Ricardo","Daniela","Andrés","Isabella"];
const apellidos = ["García","Rodríguez","Martínez","López","González","Hernández","Pérez","Sánchez","Ramírez","Torres","Flores","Rivera","Gómez","Díaz","Cruz","Morales","Reyes","Gutiérrez","Ortiz","Castillo"];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const r = rng(42);

function randomName() {
  return `${nombres[Math.floor(r() * nombres.length)]} ${apellidos[Math.floor(r() * apellidos.length)]}`;
}
function randomClabe() {
  return "6461801" + Array.from({ length: 11 }, () => Math.floor(r() * 10)).join("");
}

export const unidades: Unidad[] = Array.from({ length: 320 }, (_, i) => {
  const piso = Math.floor(i / 8) + 1;
  const u = (i % 8) + 1;
  const numero = `${String(piso).padStart(2, "0")}${String(u).padStart(2, "0")}`;
  const opcionesEstatus: Unidad["estatus"][] = ["ocupado","ocupado","ocupado","ocupado","ocupado","vacante","renta_corta","mantenimiento"];
  const estatus = opcionesEstatus[Math.floor(r() * opcionesEstatus.length)];
  const propietario = randomName();
  const tieneVencido = r() < 0.25;
  const montoVencido = tieneVencido ? Math.round((r() * 25000 + 3500) * 100) / 100 : 0;
  const ultimoPago = tieneVencido && r() < 0.3 ? null : `2025-${String(Math.floor(r() * 3) + 1).padStart(2, "0")}-${String(Math.floor(r() * 28) + 1).padStart(2, "0")}`;
  const cuota = [4500, 5200, 6800, 7500, 8900][Math.floor(r() * 5)];
  return {
    id: `unit-${numero}`,
    numero,
    piso,
    edificio: "Sozu",
    tipo: u <= 2 ? "Studio" : u <= 5 ? "1 Recámara" : u <= 7 ? "2 Recámaras" : "Penthouse",
    area_m2: u <= 2 ? 45 : u <= 5 ? 65 : u <= 7 ? 95 : 140,
    estatus,
    propietario,
    residente: estatus === "vacante" ? "—" : estatus === "renta_corta" ? "Renta corta" : r() > 0.3 ? propietario : randomName(),
    clabe: randomClabe(),
    referencia_pago: `SOZU-${numero}`,
    saldo_actual: montoVencido > 0 ? montoVencido : r() < 0.15 ? cuota : 0,
    saldo_vencido: montoVencido,
    ultimo_pago: ultimoPago,
    cuota_mensual: cuota,
  };
});

export const cargos: Cargo[] = [];
unidades.forEach((unidad) => {
  cargos.push({
    id: `chg-maint-${unidad.numero}`,
    unidad_id: unidad.id,
    unidad_numero: unidad.numero,
    concepto: "Cuota de mantenimiento - Marzo 2025",
    categoria: "mantenimiento",
    monto: unidad.cuota_mensual,
    fecha_generacion: "2025-03-01",
    fecha_vencimiento: "2025-03-10",
    estatus: unidad.saldo_actual === 0 ? "pagado" : unidad.saldo_vencido > 0 ? "vencido" : "pendiente",
    notas: "",
    creado_por: "Sistema",
  });
  if (r() < 0.08) {
    cargos.push({
      id: `chg-fine-${unidad.numero}`,
      unidad_id: unidad.id,
      unidad_numero: unidad.numero,
      concepto: "Multa por ruido excesivo",
      categoria: "multa",
      monto: 1500,
      fecha_generacion: "2025-03-05",
      fecha_vencimiento: "2025-03-15",
      estatus: r() > 0.5 ? "pendiente" : "pagado",
      notas: "Reporte de seguridad #RC-2025-089",
      creado_por: "Admin",
    });
  }
  if (r() < 0.05) {
    cargos.push({
      id: `chg-extra-${unidad.numero}`,
      unidad_id: unidad.id,
      unidad_numero: unidad.numero,
      concepto: "Derrama extraordinaria - Impermeabilización",
      categoria: "extraordinario",
      monto: 3200,
      fecha_generacion: "2025-03-01",
      fecha_vencimiento: "2025-03-20",
      estatus: "pendiente",
      notas: "Aprobada en asamblea 15/02/2025",
      creado_por: "Admin",
    });
  }
});

export const pagos: Pago[] = [];
unidades
  .filter((u) => u.ultimo_pago)
  .forEach((unidad) => {
    const excepcion = r() < 0.1;
    pagos.push({
      id: `pay-${unidad.numero}`,
      unidad_id: unidad.id,
      unidad_numero: unidad.numero,
      monto: excepcion ? unidad.cuota_mensual * 0.7 : unidad.cuota_mensual,
      fecha: unidad.ultimo_pago!,
      cuenta_origen: "0110" + Array.from({ length: 14 }, () => Math.floor(r() * 10)).join(""),
      clabe_destino: unidad.clabe,
      referencia: excepcion ? "REF-INVALIDA" : unidad.referencia_pago,
      concepto: excepcion ? "PAGO PARCIAL" : `MANT ${unidad.numero}`,
      estatus_conciliacion: excepcion ? "excepcion" : "conciliado",
      nota_conciliacion: excepcion ? "Monto no coincide" : undefined,
    });
  });
for (let i = 0; i < 12; i++) {
  pagos.push({
    id: `pay-unknown-${i}`,
    unidad_id: "",
    unidad_numero: "—",
    monto: Math.round((r() * 8000 + 2000) * 100) / 100,
    fecha: `2025-03-${String(Math.floor(r() * 18) + 1).padStart(2, "0")}`,
    cuenta_origen: "0140" + Array.from({ length: 14 }, () => Math.floor(r() * 10)).join(""),
    clabe_destino: randomClabe(),
    referencia: `REF${Math.floor(r() * 99999)}`,
    concepto: "TRANSFERENCIA",
    estatus_conciliacion: "pendiente",
  });
}

export const egresos: Egreso[] = [
  { id: "exp-1", categoria: "Nómina", concepto: "Nómina quincenal staff", monto: 185000, fecha: "2025-03-15", proveedor: "Nómina interna", estatus: "pagado", notas: "" },
  { id: "exp-2", categoria: "Limpieza", concepto: "Servicio de limpieza", monto: 45000, fecha: "2025-03-01", proveedor: "Clean Pro SA", estatus: "pagado", notas: "" },
  { id: "exp-3", categoria: "Seguridad", concepto: "Vigilancia", monto: 78000, fecha: "2025-03-01", proveedor: "SecureMX", estatus: "pagado", notas: "" },
  { id: "exp-4", categoria: "Mantenimiento", concepto: "Reparación elevador B", monto: 32000, fecha: "2025-03-08", proveedor: "Otis", estatus: "pagado", notas: "ELV-2025-012" },
  { id: "exp-5", categoria: "Servicios", concepto: "CFE áreas comunes", monto: 28500, fecha: "2025-03-05", proveedor: "CFE", estatus: "pagado", notas: "" },
  { id: "exp-6", categoria: "Internet", concepto: "Fibra óptica", monto: 12000, fecha: "2025-03-01", proveedor: "TotalPlay", estatus: "pagado", notas: "" },
  { id: "exp-7", categoria: "Mantenimiento", concepto: "Fumigación trimestral", monto: 8500, fecha: "2025-03-10", proveedor: "FumiControl", estatus: "programado", notas: "" },
  { id: "exp-8", categoria: "Proveedores", concepto: "Insumos limpieza", monto: 6800, fecha: "2025-03-12", proveedor: "Hygieia", estatus: "pendiente", notas: "" },
  { id: "exp-9", categoria: "Administración", concepto: "Honorarios", monto: 55000, fecha: "2025-03-01", proveedor: "Admin SC", estatus: "pagado", notas: "" },
  { id: "exp-10", categoria: "Seguridad", concepto: "Mantenimiento CCTV", monto: 4500, fecha: "2025-03-14", proveedor: "VideoTech", estatus: "pagado", notas: "" },
  { id: "exp-11", categoria: "Servicios", concepto: "Agua bimestre", monto: 18000, fecha: "2025-03-03", proveedor: "SACMEX", estatus: "pagado", notas: "" },
];

export const amenidades: Amenidad[] = [
  { id: "am-1", nombre: "Rooftop Lounge", descripcion: "Terraza con vista panorámica", capacidad: 40, costo: 2500, reglas: "Reservar con 48h. Horario 10-22h.", estatus: "disponible" },
  { id: "am-2", nombre: "Salón de Eventos", descripcion: "Salón con cocina y audio", capacidad: 60, costo: 3500, reglas: "Depósito $5,000 reembolsable.", estatus: "disponible" },
  { id: "am-3", nombre: "Gimnasio", descripcion: "Pesas y cardio", capacidad: 20, costo: 0, reglas: "Horario 5-23h.", estatus: "disponible" },
  { id: "am-4", nombre: "Alberca", descripcion: "Semi-olímpica climatizada", capacidad: 30, costo: 0, reglas: "Gorro obligatorio.", estatus: "disponible" },
  { id: "am-5", nombre: "Coworking", descripcion: "Espacio con salas de juntas", capacidad: 15, costo: 500, reglas: "Salas con reservación.", estatus: "disponible" },
  { id: "am-6", nombre: "Sala de Cine", descripcion: "Proyector 4K", capacidad: 12, costo: 1500, reglas: "Reservar 24h antes.", estatus: "mantenimiento" },
  { id: "am-7", nombre: "Pet Park", descripcion: "Área para mascotas", capacidad: 10, costo: 0, reglas: "Correa en accesos.", estatus: "disponible" },
];

export const reservas: Reserva[] = [
  { id: "bk-1", amenidad_id: "am-1", amenidad_nombre: "Rooftop Lounge", unidad_numero: "0301", residente: "Carlos García", fecha: "2025-03-20", hora_inicio: "18:00", hora_fin: "22:00", estatus: "aprobada", costo: 2500, notas: "Cumpleaños" },
  { id: "bk-2", amenidad_id: "am-2", amenidad_nombre: "Salón de Eventos", unidad_numero: "1205", residente: "María López", fecha: "2025-03-22", hora_inicio: "14:00", hora_fin: "20:00", estatus: "solicitada", costo: 3500, notas: "Baby shower" },
  { id: "bk-3", amenidad_id: "am-5", amenidad_nombre: "Coworking", unidad_numero: "0804", residente: "Roberto M.", fecha: "2025-03-19", hora_inicio: "09:00", hora_fin: "13:00", estatus: "aprobada", costo: 500, notas: "Junta" },
  { id: "bk-4", amenidad_id: "am-1", amenidad_nombre: "Rooftop Lounge", unidad_numero: "2506", residente: "Ana Hernández", fecha: "2025-03-25", hora_inicio: "19:00", hora_fin: "22:00", estatus: "solicitada", costo: 2500, notas: "Cena" },
  { id: "bk-5", amenidad_id: "am-2", amenidad_nombre: "Salón de Eventos", unidad_numero: "1802", residente: "Fernando T.", fecha: "2025-03-15", hora_inicio: "10:00", hora_fin: "14:00", estatus: "completada", costo: 3500, notas: "Corporativo" },
];

export const cobranza: AccionCobranza[] = unidades
  .filter((u) => u.saldo_vencido > 0)
  .slice(0, 30)
  .map((unidad, i) => {
    const acciones: AccionCobranza["tipo_accion"][] = ["llamada", "mensaje", "promesa_pago", "convenio", "nota"];
    const accion = acciones[i % acciones.length];
    const bucket: AccionCobranza["antiguedad"] =
      unidad.saldo_vencido > 20000 ? "90+" : unidad.saldo_vencido > 12000 ? "61-90" : unidad.saldo_vencido > 6000 ? "31-60" : "1-30";
    return {
      id: `col-${i}`,
      unidad_id: unidad.id,
      unidad_numero: unidad.numero,
      propietario: unidad.propietario,
      monto_vencido: unidad.saldo_vencido,
      antiguedad: bucket,
      ultimo_pago: unidad.ultimo_pago,
      tipo_accion: accion,
      fecha_accion: `2025-03-${String((i % 18) + 1).padStart(2, "0")}`,
      fecha_promesa: accion === "promesa_pago" ? `2025-03-${String(20 + (i % 9)).padStart(2, "0")}` : null,
      estatus_promesa: accion === "promesa_pago" ? "pendiente" : null,
      notas: accion === "llamada" ? "Contactado, paga esta semana" : accion === "mensaje" ? "Recordatorio WhatsApp" : accion === "promesa_pago" ? "Promete fin de mes" : "Seguimiento",
      agente: ["Admin García", "Cobranza López", "Admin Martínez"][i % 3],
    };
  });

export function getKPIs() {
  const totalEsperado = unidades.reduce((s, u) => s + u.cuota_mensual, 0);
  const totalCobrado = pagos.filter((p) => p.estatus_conciliacion === "conciliado" && p.fecha >= "2025-03-01").reduce((s, p) => s + p.monto, 0);
  const totalVencido = unidades.reduce((s, u) => s + u.saldo_vencido, 0);
  const morosos = unidades.filter((u) => u.saldo_vencido > 0).length;
  const excepciones = pagos.filter((p) => p.estatus_conciliacion === "excepcion" || p.estatus_conciliacion === "pendiente").length;
  const multasPendientes = cargos.filter((c) => c.categoria === "multa" && c.estatus === "pendiente").length;
  const extraPendientes = cargos.filter((c) => c.categoria === "extraordinario" && c.estatus === "pendiente").length;
  const totalEgresos = egresos.reduce((s, e) => s + e.monto, 0);
  return {
    totalEsperado,
    totalCobrado,
    tasaCobranza: totalEsperado > 0 ? Math.round((totalCobrado / totalEsperado) * 100) : 0,
    totalVencido,
    morosos,
    excepciones,
    multasPendientes,
    extraPendientes,
    totalEgresos,
    balanceNeto: totalCobrado - totalEgresos,
  };
}

export const tendenciaMensual = [
  { mes: "Oct", esperado: 1920000, cobrado: 1750000, egresos: 620000 },
  { mes: "Nov", esperado: 1920000, cobrado: 1820000, egresos: 580000 },
  { mes: "Dic", esperado: 1920000, cobrado: 1680000, egresos: 710000 },
  { mes: "Ene", esperado: 1920000, cobrado: 1850000, egresos: 650000 },
  { mes: "Feb", esperado: 1920000, cobrado: 1790000, egresos: 590000 },
  { mes: "Mar", esperado: 1920000, cobrado: 1200000, egresos: 658300 },
];

export const antiguedad = [
  { rango: "1-30 días", monto: 185000, cuentas: 28 },
  { rango: "31-60 días", monto: 124000, cuentas: 18 },
  { rango: "61-90 días", monto: 78000, cuentas: 10 },
  { rango: "90+ días", monto: 156000, cuentas: 12 },
];

export function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}