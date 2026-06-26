export type Categoria = 'Paquete de muebles' | 'Bodega' | 'Condensadora' | 'Estacionamiento';
// Proyecto y Propietario provienen de la BD real (valores dinámicos) → string.
export type Propietario = string;
export type Proyecto = string;
export type EstatusPago = 'pagado' | 'al_corriente' | 'atrasado' | 'vencido';

export interface Persona { id: string; nombreLegal: string; rfc: string; }

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: Categoria;
  proyecto: Proyecto;
  precioLista: number;
  satId: string | null;
  unidadSat: string | null;
  propietario: Propietario;
  clabe: string;
}

export interface Propiedad {
  id: string; noPropiedad: string; modelo: string; edificio: string;
  proyecto: Proyecto; tipo: 'Loft' | 'Departamento'; metraje: number | null;
  estatus: 'Vendido' | 'Apartado' | 'Disponible';
}

export interface AcuerdoPago {
  id: string; orden: number; nombre: string;
  porcentaje: number; monto: number;
  fechaCompromiso: string | null; pagoCompletado: boolean;
}

export interface AplicacionPago {
  id: string; acuerdoId: string; fechaPago: string;
  metodo: 'STP' | 'SPEI' | 'Transferencia';
  claveRastreo: string; montoAplicado: number; evidencia: string | null;
}

export interface CuentaProducto {
  id: string;
  tipo: 'Producto';
  producto: Producto;
  propiedad: Propiedad;
  proyecto: Proyecto;
  compradores: { persona: Persona; porcentaje: number }[];
  agenteVendedor: string;
  ofertaId: string;
  clabeStp: string;
  fechaCompra: string;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  acuerdos: AcuerdoPago[];
  aplicaciones: AplicacionPago[];
}

export interface GlobalFilters {
  proyecto: Proyecto | 'all';
  propietario: Propietario | 'all';
  categoria: Categoria | 'all';
  rangoMeses: number; // últimos N meses; 0 = "Todo el periodo"
}

export const CATEGORIAS: Categoria[] = ['Paquete de muebles', 'Bodega', 'Condensadora', 'Estacionamiento'];
export const PROPIETARIOS: Propietario[] = ['Komakai', 'Tallwood', 'Hevi Holding'];
export const PROYECTOS: Proyecto[] = ['Daiku', 'Margot', 'Monócolo', 'Bottura'];

export const CATEGORIA_LABEL_CORTO: Record<Categoria, string> = {
  'Paquete de muebles': 'Muebles',
  'Bodega': 'Bodega',
  'Condensadora': 'Condensadora',
  'Estacionamiento': 'Estac.',
};