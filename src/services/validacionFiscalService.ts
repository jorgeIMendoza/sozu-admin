/**
 * Service for fiscal data validation between XML invoices and CSF (Constancia de Situación Fiscal)
 * Calls n8n webhook to extract data and compares fields
 */

import { N8N_WEBHOOK_BASE_URL, ENVIRONMENT } from '@/lib/config';

// Types for the NEW webhook response format
export interface CsfDatosIdentificacion {
  id_cif: string;
  rfc: string;
  curp: string;
  nombre: string;
  fecha_inicio_operaciones: string;
  estatus: string;
}

export interface CsfDomicilioFiscal {
  codigo_postal: string;
  vialidad: string;
  numero_exterior?: string;
  numero_interior?: string;
  colonia: string;
  municipio: string;
  entidad: string;
}

export interface ConstanciaSituacionFiscal {
  origen: string;
  datos_identificacion: CsfDatosIdentificacion;
  domicilio_fiscal: CsfDomicilioFiscal;
  regimenes: string[];
}

export interface CfdiInformacionGeneral {
  version: string;
  folio: string;
  fecha: string;
  uuid: string;
  tipo_comprobante: string;
  lugar_expedicion: string;
}

export interface CfdiEmisor {
  rfc: string;
  nombre: string;
  regimen_fiscal: string;
}

export interface CfdiReceptor {
  rfc: string;
  nombre: string;
  uso_cfdi: string;
  domicilio_fiscal: string;
  regimen_fiscal: string;
}

export interface CfdiTotales {
  moneda: string;
  subtotal: number;
  total: number;
}

export interface CfdiConcepto {
  clave_prod_serv: string;
  cantidad: number;
  descripcion: string;
  importe: number;
}

export interface FacturaCfdi {
  origen: string;
  informacion_general: CfdiInformacionGeneral;
  emisor: CfdiEmisor;
  receptor: CfdiReceptor;
  totales: CfdiTotales;
  conceptos: CfdiConcepto[];
}

export interface DocumentosProcesados {
  constancia_situacion_fiscal: ConstanciaSituacionFiscal;
  factura_cfdi: FacturaCfdi;
}

export interface ExtractionResult {
  documentos_procesados: DocumentosProcesados;
}

export interface ComparisonResult {
  campo: string;
  valorXml: string;
  valorCsf: string;
  coincide: boolean;
  detalle?: string;
  esRequerido?: boolean;
}

export interface DatosValidados {
  csf: ConstanciaSituacionFiscal;
  cfdi: FacturaCfdi;
  comparacion: ComparisonResult[];
  todoCoincide: boolean;
  camposRequeridosCoinciden: boolean;
}

/**
 * Normalizes a name for comparison
 * - Converts to uppercase
 * - Removes accents
 * - Normalizes whitespace
 */
export function normalizarNombre(nombre: string): string {
  if (!nombre) return '';
  return nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

/**
 * Compares RFC values (case insensitive, no spaces)
 */
function compararRfc(rfcXml: string, rfcCsf: string): boolean {
  const normalizedXml = (rfcXml || '').toUpperCase().replace(/\s/g, '');
  const normalizedCsf = (rfcCsf || '').toUpperCase().replace(/\s/g, '');
  return normalizedXml === normalizedCsf;
}

/**
 * Compares name values with normalization
 */
function compararNombre(nombreXml: string, nombreCsf: string): boolean {
  return normalizarNombre(nombreXml) === normalizarNombre(nombreCsf);
}

/**
 * Compares postal codes (ignores spaces)
 */
function compararCodigoPostal(cpXml: string, cpCsf: string): boolean {
  const normalizedXml = (cpXml || '').replace(/\s/g, '');
  const normalizedCsf = (cpCsf || '').replace(/\s/g, '');
  return normalizedXml === normalizedCsf;
}

/**
 * Validates that the CFDI receptor regime exists in the CSF regimes list
 * The CSF contains regime names while CFDI has regime codes
 */
function validarRegimen(regimenCfdi: string, regimenesCsf: string[]): boolean {
  if (!regimenesCsf || regimenesCsf.length === 0) return false;
  
  // Common regime code to name mappings
  const regimenCodeMap: Record<string, string[]> = {
    '601': ['General de Ley Personas Morales'],
    '603': ['Personas Morales con Fines no Lucrativos'],
    '605': ['Sueldos y Salarios', 'Sueldos y Salarios e Ingresos Asimilados a Salarios'],
    '606': ['Arrendamiento'],
    '607': ['Régimen de Enajenación o Adquisición de Bienes'],
    '608': ['Demás ingresos'],
    '610': ['Residentes en el Extranjero sin Establecimiento Permanente en México'],
    '611': ['Ingresos por Dividendos'],
    '612': ['Personas Físicas con Actividades Empresariales y Profesionales'],
    '614': ['Ingresos por intereses'],
    '615': ['Régimen de los ingresos por obtención de premios'],
    '616': ['Sin obligaciones fiscales'],
    '620': ['Sociedades Cooperativas de Producción'],
    '621': ['Incorporación Fiscal'],
    '622': ['Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras'],
    '623': ['Opcional para Grupos de Sociedades'],
    '624': ['Coordinados'],
    '625': ['Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'],
    '626': ['Régimen Simplificado de Confianza'],
  };

  const nombresBuscados = regimenCodeMap[regimenCfdi] || [];
  
  // Check if any of the CSF regimes match the CFDI regime code mapping
  for (const regimenCsf of regimenesCsf) {
    const normalizado = normalizarNombre(regimenCsf);
    for (const nombreBuscado of nombresBuscados) {
      if (normalizado.includes(normalizarNombre(nombreBuscado))) {
        return true;
      }
    }
    // Also check if the regime string contains the code directly
    if (regimenCsf.includes(regimenCfdi)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extracts data from XML and CSF by calling the n8n webhook
 */
export async function extraerDatos(
  xmlUrl: string,
  csfUrl: string,
  cuentaId: number,
  personaId: number
): Promise<ExtractionResult> {
  const payload = {
    xml_url: xmlUrl,
    csf_url: csfUrl,
    id_cuenta_cobranza: cuentaId,
    id_persona: personaId,
    ambiente: ENVIRONMENT
  };

  console.log('Calling n8n webhook for data extraction:', payload);

  try {
    const response = await fetch(`${N8N_WEBHOOK_BASE_URL}/extraerDatosXmlCsf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error en la extracción: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Extraction response:', data);
    
    return data as ExtractionResult;
  } catch (error) {
    console.error('Error extracting data:', error);
    throw error;
  }
}

/**
 * Compares fields between CFDI receptor and CSF data
 */
export function compararCampos(cfdi: FacturaCfdi, csf: ConstanciaSituacionFiscal): ComparisonResult[] {
  const resultados: ComparisonResult[] = [];

  // 1. RFC (REQUIRED)
  const rfcCoincide = compararRfc(cfdi.receptor.rfc, csf.datos_identificacion.rfc);
  resultados.push({
    campo: 'RFC',
    valorXml: cfdi.receptor.rfc || '-',
    valorCsf: csf.datos_identificacion.rfc || '-',
    coincide: rfcCoincide,
    esRequerido: true
  });

  // 2. Nombre (REQUIRED)
  const nombreCoincide = compararNombre(cfdi.receptor.nombre, csf.datos_identificacion.nombre);
  resultados.push({
    campo: 'Nombre',
    valorXml: cfdi.receptor.nombre || '-',
    valorCsf: csf.datos_identificacion.nombre || '-',
    coincide: nombreCoincide,
    esRequerido: true,
    detalle: !nombreCoincide 
      ? `XML: "${normalizarNombre(cfdi.receptor.nombre)}" vs CSF: "${normalizarNombre(csf.datos_identificacion.nombre)}"` 
      : undefined
  });

  // 3. Código Postal del Domicilio Fiscal (REQUIRED)
  const cpCoincide = compararCodigoPostal(cfdi.receptor.domicilio_fiscal, csf.domicilio_fiscal.codigo_postal);
  resultados.push({
    campo: 'Código Postal',
    valorXml: cfdi.receptor.domicilio_fiscal || '-',
    valorCsf: csf.domicilio_fiscal.codigo_postal || '-',
    coincide: cpCoincide,
    esRequerido: true
  });

  // 4. Régimen Fiscal (optional comparison, informative)
  const regimenesStr = csf.regimenes?.join(', ') || '-';
  const regimenCoincide = validarRegimen(cfdi.receptor.regimen_fiscal, csf.regimenes);
  resultados.push({
    campo: 'Régimen Fiscal',
    valorXml: cfdi.receptor.regimen_fiscal || '-',
    valorCsf: regimenesStr,
    coincide: regimenCoincide,
    esRequerido: false,
    detalle: regimenCoincide 
      ? `Régimen ${cfdi.receptor.regimen_fiscal} encontrado en CSF` 
      : `Régimen ${cfdi.receptor.regimen_fiscal} no está en la lista del CSF (puede diferir)`
  });

  // 5. Estatus en SAT (informative only)
  resultados.push({
    campo: 'Estatus SAT',
    valorXml: '-',
    valorCsf: csf.datos_identificacion.estatus || '-',
    coincide: csf.datos_identificacion.estatus?.toUpperCase() === 'ACTIVO',
    esRequerido: false,
    detalle: csf.datos_identificacion.estatus?.toUpperCase() !== 'ACTIVO' 
      ? 'El contribuyente no está activo en el SAT' 
      : 'Contribuyente activo'
  });

  return resultados;
}

/**
 * Validates and returns the complete validation data
 */
export function validarDatosFiscales(csf: ConstanciaSituacionFiscal, cfdi: FacturaCfdi): DatosValidados {
  const comparacion = compararCampos(cfdi, csf);
  const todoCoincide = comparacion.every(c => c.coincide);
  const camposRequeridosCoinciden = comparacion
    .filter(c => c.esRequerido)
    .every(c => c.coincide);

  return {
    csf,
    cfdi,
    comparacion,
    todoCoincide,
    camposRequeridosCoinciden
  };
}

/**
 * Extracts birth date from CURP
 * CURP format: AAAA000000XXXXXXXX00
 *              ^^^^---------- First 4 letters (names)
 *                  ^^^^^^---- Birth date YYMMDD (positions 5-10)
 */
export function extraerFechaNacimientoDeCurp(curp: string): string | null {
  if (!curp || curp.length < 10) return null;
  
  const fechaPart = curp.substring(4, 10);
  const year = parseInt(fechaPart.substring(0, 2), 10);
  const month = fechaPart.substring(2, 4);
  const day = fechaPart.substring(4, 6);
  
  // Determine century: if year > 30, assume 1900s, otherwise 2000s
  const fullYear = year > 30 ? 1900 + year : 2000 + year;
  
  return `${fullYear}-${month}-${day}`;
}

/**
 * Parses a name into parts (nombre, apellido paterno, apellido materno)
 * Assumes format: "NOMBRE(S) APELLIDO_PATERNO APELLIDO_MATERNO"
 */
export function parsearNombreCompleto(nombreCompleto: string): { 
  nombres: string; 
  apellidoPaterno: string; 
  apellidoMaterno: string 
} {
  if (!nombreCompleto) {
    return { nombres: '', apellidoPaterno: '', apellidoMaterno: '' };
  }

  const partes = nombreCompleto.trim().split(/\s+/);
  
  if (partes.length === 1) {
    return { nombres: partes[0], apellidoPaterno: '', apellidoMaterno: '' };
  }
  
  if (partes.length === 2) {
    return { nombres: partes[0], apellidoPaterno: partes[1], apellidoMaterno: '' };
  }
  
  if (partes.length === 3) {
    return { nombres: partes[0], apellidoPaterno: partes[1], apellidoMaterno: partes[2] };
  }
  
  // More than 3 parts: assume last two are apellidos
  const apellidoMaterno = partes[partes.length - 1];
  const apellidoPaterno = partes[partes.length - 2];
  const nombres = partes.slice(0, partes.length - 2).join(' ');
  
  return { nombres, apellidoPaterno, apellidoMaterno };
}

/**
 * Interface for Excel SAT data matching the template structure
 */
export interface ExcelSatData {
  // Datos generales
  rfc_emisor: string;
  periodo: string; // AAAAMM format
  referencia: string; // CC-{id}
  prioridad: string;
  tipo_alerta: string;
  
  // Identificación persona física
  persona_fisica: {
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    fecha_nacimiento: string;
    rfc: string;
    curp: string;
    pais_nacionalidad: string;
    actividad_economica: string;
  };
  
  // Domicilio nacional
  domicilio: {
    codigo_postal: string;
    estado: string;
    municipio: string;
    colonia: string;
    calle: string;
    numero_exterior: string;
    numero_interior: string;
  };
  
  // Datos adicionales de la factura
  factura: {
    uuid: string;
    fecha: string;
    total: number;
    emisor_rfc: string;
    emisor_nombre: string;
  };
}

/**
 * Prepares data for the SAT Excel file based on the new format
 */
export function prepararDatosExcelSat(
  datosValidados: DatosValidados,
  cuentaId: number
): ExcelSatData {
  const { csf, cfdi } = datosValidados;
  
  // Extract birth date from CURP
  const fechaNacimiento = extraerFechaNacimientoDeCurp(csf.datos_identificacion.curp) || '';
  
  // Get current year-month for periodo
  const now = new Date();
  const periodo = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Parse full name into parts
  const nombrePartes = parsearNombreCompleto(csf.datos_identificacion.nombre);
  
  return {
    rfc_emisor: cfdi.emisor.rfc || '',
    periodo,
    referencia: `CC-${cuentaId}`,
    prioridad: '',
    tipo_alerta: '',
    
    persona_fisica: {
      nombres: nombrePartes.nombres,
      apellido_paterno: nombrePartes.apellidoPaterno,
      apellido_materno: nombrePartes.apellidoMaterno,
      fecha_nacimiento: fechaNacimiento,
      rfc: csf.datos_identificacion.rfc || '',
      curp: csf.datos_identificacion.curp || '',
      pais_nacionalidad: 'México',
      actividad_economica: csf.regimenes?.[0] || ''
    },
    
    domicilio: {
      codigo_postal: csf.domicilio_fiscal.codigo_postal || '',
      estado: csf.domicilio_fiscal.entidad || '',
      municipio: csf.domicilio_fiscal.municipio || '',
      colonia: csf.domicilio_fiscal.colonia || '',
      calle: csf.domicilio_fiscal.vialidad || '',
      numero_exterior: csf.domicilio_fiscal.numero_exterior || '',
      numero_interior: csf.domicilio_fiscal.numero_interior || ''
    },
    
    factura: {
      uuid: cfdi.informacion_general.uuid || '',
      fecha: cfdi.informacion_general.fecha || '',
      total: cfdi.totales.total || 0,
      emisor_rfc: cfdi.emisor.rfc || '',
      emisor_nombre: cfdi.emisor.nombre || ''
    }
  };
}
