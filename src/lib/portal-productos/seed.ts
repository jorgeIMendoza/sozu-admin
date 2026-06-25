import type { CuentaProducto, Categoria, Propietario, Proyecto, Producto, Propiedad, Persona, AcuerdoPago, AplicacionPago } from './types';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES = ['Alejandro Ruiz', 'María Fernanda López', 'Carlos Mendoza', 'Sofía Gutiérrez', 'Javier Cárdenas', 'Daniela Robles', 'Eduardo Vázquez', 'Paulina Estrada', 'Ricardo Cordero', 'Mariana Solís', 'Andrés Bautista', 'Gabriela Núñez', 'Sebastián Ortiz', 'Valeria Aguirre', 'Iván Domínguez', 'Renata Carrillo', 'Felipe Saldívar', 'Camila Peña', 'Mauricio Trejo', 'Ana Cristina Pacheco', 'Diego Aranda', 'Lucía Ovalle', 'Tomás Belmonte', 'Regina Quintero', 'Bruno Maldonado'];
const APELLIDOS_RFC = ['RULA','LOMA','MECA','GUSO','CAJA','RODA','VAEA','ESPA','COCO','SOMA'];
const AGENTES = ['Pablo Espinosa Galván', 'Lorena Aguilar Sosa', 'Ricardo Vidal Núñez', 'Mariana Téllez Ríos'];

const PAQUETES = [
  { nombre: 'Paquete amueblado Gala', desc: 'Sala, comedor, recámara principal y accesorios línea Gala' },
  { nombre: 'Paquete amueblado Lumen', desc: 'Sala modular, comedor 4 pax, recámara y accesorios línea Lumen' },
  { nombre: 'Paquete amueblado Noir', desc: 'Edición Noir: muebles, electrodomésticos premium y decoración' },
  { nombre: 'Paquete amueblado Origen', desc: 'Línea base Origen con muebles esenciales y textiles' },
];
const BODEGAS = [
  { nombre: 'Bodega Tipo A', desc: 'Bodega 4–6 m² nivel sótano' },
  { nombre: 'Bodega Tipo B', desc: 'Bodega 6–9 m² nivel sótano' },
];
const CONDENSADORAS = [
  { nombre: 'Condensadora 1 TR', desc: 'Equipo de aire acondicionado individual 1 tonelada' },
  { nombre: 'Condensadora 1.5 TR', desc: 'Equipo de aire acondicionado individual 1.5 toneladas' },
];
const ESTACIONAMIENTOS = [
  { nombre: 'Cajón Estacionamiento Sencillo', desc: 'Cajón individual nivel sótano' },
  { nombre: 'Cajón Estacionamiento Doble', desc: 'Cajón doble en línea nivel sótano' },
];

const MODELOS = ['Gala', 'Lumen', 'Noir', 'Origen'];
const EDIFICIOS_POR_PROYECTO: Record<Proyecto, string[]> = {
  Daiku: ['Torre Norte', 'Torre Sur'],
  Margot: ['Edificio A', 'Edificio B'],
  Monócolo: ['Mono I'],
  Bottura: ['Bottura', 'Bottura Anexo'],
};

function pad(n: number, w: number) { return String(n).padStart(w, '0'); }

function makeRFC(rand: () => number): string {
  const ap = APELLIDOS_RFC[Math.floor(rand() * APELLIDOS_RFC.length)];
  const yy = 70 + Math.floor(rand() * 35);
  const mm = pad(1 + Math.floor(rand() * 12), 2);
  const dd = pad(1 + Math.floor(rand() * 28), 2);
  const ext = String.fromCharCode(65 + Math.floor(rand() * 26)) + String.fromCharCode(65 + Math.floor(rand() * 26)) + Math.floor(rand() * 10);
  return `${ap}${yy}${mm}${dd}${ext}`;
}

function pickPropietario(cat: Categoria, rand: () => number): Propietario {
  if (cat === 'Paquete de muebles') return rand() < 0.75 ? 'Komakai' : rand() < 0.5 ? 'Tallwood' : 'Hevi Holding';
  if (cat === 'Bodega') return rand() < 0.6 ? 'Tallwood' : rand() < 0.5 ? 'Hevi Holding' : 'Komakai';
  if (cat === 'Condensadora') return rand() < 0.55 ? 'Tallwood' : rand() < 0.5 ? 'Hevi Holding' : 'Komakai';
  return rand() < 0.5 ? 'Komakai' : rand() < 0.5 ? 'Tallwood' : 'Hevi Holding';
}

function precioRange(cat: Categoria, rand: () => number): number {
  const r = (a: number, b: number) => Math.round((a + rand() * (b - a)) / 100) * 100;
  switch (cat) {
    case 'Paquete de muebles': return r(250000, 410000);
    case 'Bodega': return r(29000, 50000);
    case 'Condensadora': return r(11000, 29000);
    case 'Estacionamiento': return r(80000, 160000);
  }
}

function pickCatalogo(cat: Categoria, rand: () => number) {
  const arr = cat === 'Paquete de muebles' ? PAQUETES : cat === 'Bodega' ? BODEGAS : cat === 'Condensadora' ? CONDENSADORAS : ESTACIONAMIENTOS;
  return arr[Math.floor(rand() * arr.length)];
}

function cryptoRand(rand: () => number) {
  return Math.floor(rand() * 1e9).toString(36).toUpperCase();
}

function planForCategoria(cat: Categoria, precio: number, fechaCompra: Date, rand: () => number): { acuerdos: AcuerdoPago[] } {
  const enganchePct = Math.round((0.2 + rand() * 0.1) * 100) / 100;
  const contraPct = 0.2;
  const restoPct = Math.max(0, 1 - enganchePct - contraPct);
  const nMens = cat === 'Paquete de muebles' ? 6 + Math.floor(rand() * 7) : 4 + Math.floor(rand() * 5);
  const acuerdos: AcuerdoPago[] = [];
  const baseDate = new Date(fechaCompra);
  acuerdos.push({
    id: `AP-${cryptoRand(rand)}`, orden: 1, nombre: 'Enganche',
    porcentaje: enganchePct, monto: Math.round(precio * enganchePct),
    fechaCompromiso: baseDate.toISOString(), pagoCompletado: false,
  });
  const entrega = new Date(baseDate); entrega.setMonth(entrega.getMonth() + 1);
  acuerdos.push({
    id: `AP-${cryptoRand(rand)}`, orden: 2, nombre: 'Pago a contra entrega',
    porcentaje: contraPct, monto: Math.round(precio * contraPct),
    fechaCompromiso: entrega.toISOString(), pagoCompletado: false,
  });
  const mensMonto = Math.round((precio * restoPct) / nMens);
  for (let i = 0; i < nMens; i++) {
    const f = new Date(entrega); f.setMonth(f.getMonth() + i + 1);
    acuerdos.push({
      id: `AP-${cryptoRand(rand)}`, orden: 3 + i, nombre: `Mensualidad ${i + 1}`,
      porcentaje: restoPct / nMens, monto: mensMonto,
      fechaCompromiso: f.toISOString(), pagoCompletado: false,
    });
  }
  return { acuerdos };
}

export function generarSeed(): CuentaProducto[] {
  const rand = mulberry32(20260625);
  const cuentas: CuentaProducto[] = [];

  const distribucion: Categoria[] = [
    ...Array(30).fill('Paquete de muebles'),
    ...Array(10).fill('Bodega'),
    ...Array(8).fill('Condensadora'),
    ...Array(7).fill('Estacionamiento'),
  ] as Categoria[];

  let idx = 0;
  for (const categoria of distribucion) {
    idx++;
    const proyecto = (['Daiku', 'Margot', 'Monócolo', 'Bottura'] as Proyecto[])[Math.floor(rand() * 4)];
    const propietario = pickPropietario(categoria, rand);
    const cat = pickCatalogo(categoria, rand);
    const precioFinal = precioRange(categoria, rand);
    const tieneSat = rand() < 0.15;
    const producto: Producto = {
      id: `PRD-${pad(idx, 3)}`,
      nombre: cat.nombre,
      descripcion: cat.desc,
      categoria,
      proyecto,
      precioLista: precioFinal,
      satId: tieneSat ? `${56101500 + Math.floor(rand() * 999)}` : null,
      unidadSat: tieneSat ? 'H87' : null,
      propietario,
      clabe: `${646180287 + Math.floor(rand() * 99999)}`,
    };
    const modelo = MODELOS[Math.floor(rand() * MODELOS.length)];
    const edificios = EDIFICIOS_POR_PROYECTO[proyecto];
    const propiedad: Propiedad = {
      id: `PROP-${pad(idx, 3)}`,
      noPropiedad: `${100 + Math.floor(rand() * 600)}`,
      modelo, edificio: edificios[Math.floor(rand() * edificios.length)],
      proyecto, tipo: rand() < 0.3 ? 'Loft' : 'Departamento',
      metraje: Math.round(45 + rand() * 90),
      estatus: 'Vendido',
    };
    const fechaCompra = new Date();
    fechaCompra.setMonth(fechaCompra.getMonth() - Math.floor(rand() * 14));
    fechaCompra.setDate(1 + Math.floor(rand() * 27));
    const nCompradores = rand() < 0.25 ? 2 : 1;
    const compradores: { persona: Persona; porcentaje: number }[] = [];
    for (let c = 0; c < nCompradores; c++) {
      const nombre = NOMBRES[Math.floor(rand() * NOMBRES.length)];
      compradores.push({
        persona: { id: `PER-${pad(idx, 3)}-${c}`, nombreLegal: nombre, rfc: makeRFC(rand) },
        porcentaje: nCompradores === 1 ? 1 : c === 0 ? 0.6 : 0.4,
      });
    }

    const { acuerdos } = planForCategoria(categoria, precioFinal, fechaCompra, rand);

    const r = rand();
    let objetivo: 'pagado' | 'al_corriente' | 'atrasado' | 'vencido';
    if (r < 0.45) objetivo = 'pagado';
    else if (r < 0.75) objetivo = 'al_corriente';
    else if (r < 0.90) objetivo = 'atrasado';
    else objetivo = 'vencido';

    const hoy = new Date();

    if (objetivo === 'vencido') {
      const candidato = acuerdos.find(a => new Date(a.fechaCompromiso!) >= hoy) ?? acuerdos[acuerdos.length - 1];
      const d = new Date(); d.setDate(d.getDate() - (15 + Math.floor(rand() * 100)));
      candidato.fechaCompromiso = d.toISOString();
    }
    if (objetivo === 'atrasado') {
      const candidato = acuerdos.find(a => new Date(a.fechaCompromiso!) >= hoy) ?? acuerdos[acuerdos.length - 1];
      const d = new Date(); d.setDate(d.getDate() + Math.floor(rand() * 7));
      candidato.fechaCompromiso = d.toISOString();
    }

    const frac =
      objetivo === 'pagado'        ? 1
      : objetivo === 'al_corriente' ? 0.40 + rand() * 0.45
      : objetivo === 'atrasado'     ? 0.30 + rand() * 0.40
      :                               0.10 + rand() * 0.45;

    let restante = Math.min(Math.round((precioFinal * frac) / 100) * 100, precioFinal);
    const totalPagadoObjetivo = restante;

    const aplicaciones: AplicacionPago[] = [];
    const sortable = acuerdos.slice().sort((a, b) => a.orden - b.orden);
    for (const a of sortable) {
      if (restante <= 0) break;
      const esCriticoVencido = objetivo === 'vencido' && new Date(a.fechaCompromiso!) < hoy;
      const esCriticoAtrasado = objetivo === 'atrasado'
        && new Date(a.fechaCompromiso!) >= hoy
        && (new Date(a.fechaCompromiso!).getTime() - hoy.getTime()) / 86400000 <= 7;
      if (esCriticoVencido || esCriticoAtrasado) continue;
      const aplica = Math.min(a.monto, restante);
      if (aplica <= 0) continue;
      const fp = new Date(a.fechaCompromiso ?? fechaCompra);
      fp.setDate(fp.getDate() - Math.floor(rand() * 3));
      aplicaciones.push({
        id: `APL-${cryptoRand(rand)}`, acuerdoId: a.id,
        fechaPago: fp.toISOString(),
        metodo: rand() < 0.6 ? 'STP' : rand() < 0.5 ? 'SPEI' : 'Transferencia',
        claveRastreo: `MX${Date.now().toString().slice(-6)}${cryptoRand(rand).slice(0, 6)}`,
        montoAplicado: aplica, evidencia: null,
      });
      if (aplica >= a.monto) a.pagoCompletado = true;
      restante -= aplica;
    }

    const totalPagado = Math.min(totalPagadoObjetivo - restante, precioFinal);
    const saldoPendiente = Math.max(0, precioFinal - totalPagado);

    cuentas.push({
      id: `CCP-${pad(idx, 3)}`,
      tipo: 'Producto',
      producto, propiedad, proyecto, compradores,
      agenteVendedor: AGENTES[Math.floor(rand() * AGENTES.length)],
      ofertaId: `OP-${pad(1000 + idx, 4)}`,
      clabeStp: `${646180287 + Math.floor(rand() * 99999)}`,
      fechaCompra: fechaCompra.toISOString(),
      precioFinal, totalPagado, saldoPendiente,
      acuerdos, aplicaciones,
    });
  }

  return cuentas;
}