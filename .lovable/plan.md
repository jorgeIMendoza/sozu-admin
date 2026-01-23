
# Plan: Sistema de Validación Fiscal XML/CSF y Descarga de XML

## Resumen Ejecutivo
Implementar un sistema que:
1. Permita descargar el XML de la factura al hacer clic en el badge "XML" 
2. Llame a un endpoint de n8n para extraer datos del XML y CSF
3. Compare los campos fiscales y muestre un reporte visual de coincidencias
4. Genere el Excel de "Presentación de Aviso al SAT" cuando todos los campos coincidan

---

## Datos de Ejemplo (Cuenta 207)

**XML de Factura encontrado:**
- ID Documento: 8567
- URL: `https://drive.google.com/file/d/1zjHL55j79XoTWFfew-rlyTPQGrLnZKtA/preview`
- Persona asociada: ID 1480

**CSF proporcionada (CIF-2.pdf):**
- RFC: SASM491008LB8
- Nombre: MARIO ALBERTO SALAZAR SALAS
- CURP: SASM491008HASLLR04
- Código Postal: 44130
- Calle: EMILIO CASTELAR 72 Int. 1
- Colonia: ARCOS VALLARTA
- Municipio: GUADALAJARA
- Estado: JALISCO
- Regímenes: 605 (Actividades Empresariales), 612 (Sueldos y Salarios)

---

## Especificación del Endpoint n8n

### Webhook: `/extraerDatosXmlCsf`

**Payload de Entrada:**
```json
{
  "xml_url": "https://drive.google.com/file/d/1zjHL55j79XoTWFfew-rlyTPQGrLnZKtA/preview",
  "csf_url": "https://drive.google.com/file/d/XXXXX/preview",
  "id_cuenta_cobranza": 207,
  "id_persona": 1480,
  "ambiente": "produccion"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "xml": {
    "rfc": "SASM491008LB8",
    "nombre": "MARIO ALBERTO SALAZAR SALAS",
    "codigo_postal": "44130",
    "regimen_fiscal": "605",
    "uso_cfdi": "G03",
    "uuid": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
    "fecha_emision": "2025-01-15",
    "total": 1500000.00,
    "emisor_rfc": "ABC123456XYZ",
    "emisor_nombre": "DESARROLLADORA EJEMPLO SA DE CV"
  },
  "csf": {
    "rfc": "SASM491008LB8",
    "curp": "SASM491008HASLLR04",
    "nombre": "MARIO ALBERTO",
    "apellido_paterno": "SALAZAR",
    "apellido_materno": "SALAS",
    "nombre_completo": "MARIO ALBERTO SALAZAR SALAS",
    "codigo_postal": "44130",
    "calle": "EMILIO CASTELAR",
    "numero_exterior": "72",
    "numero_interior": "1",
    "colonia": "ARCOS VALLARTA",
    "municipio": "GUADALAJARA",
    "estado": "JALISCO",
    "regimenes": [
      { "codigo": "605", "nombre": "Régimen de las Personas Físicas con Actividades Empresariales y Profesionales" },
      { "codigo": "612", "nombre": "Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios" }
    ],
    "estatus_padron": "ACTIVO",
    "fecha_inicio_operaciones": "1992-08-01"
  }
}
```

**Campos Críticos del XML (nodo cfdi:Receptor):**
- `@Rfc` → `xml.rfc`
- `@Nombre` → `xml.nombre`
- `@DomicilioFiscalReceptor` → `xml.codigo_postal`
- `@RegimenFiscalReceptor` → `xml.regimen_fiscal`
- `@UsoCFDI` → `xml.uso_cfdi`

---

## Campos a Comparar

| Campo | XML (Receptor) | CSF | Tipo de Comparación |
|-------|----------------|-----|---------------------|
| RFC | `xml.rfc` | `csf.rfc` | Exacta (sin espacios) |
| Nombre | `xml.nombre` | `csf.nombre_completo` | Normalizada (mayúsculas, sin acentos) |
| Código Postal | `xml.codigo_postal` | `csf.codigo_postal` | Exacta |
| Régimen Fiscal | `xml.regimen_fiscal` | `csf.regimenes[].codigo` | El código del XML debe existir en la lista de regímenes del CSF |

---

## Estructura del Excel a Generar

**Hoja: Datos Generales**
| Campo | Valor Origen |
|-------|--------------|
| RFC | Emisor de la factura (desarrollador/inmobiliaria) |
| Periodo (AAAAMM) | Fecha de la operación de venta |
| Referencia | ID de cuenta de cobranza (ej: "CC-207") |
| Prioridad | "NORMAL" (valor fijo) |
| Tipo de alerta | (vacío o según reglas de negocio) |

**Hoja: Persona Física (Comprador)**
| Campo | Valor Origen |
|-------|--------------|
| Nombre(s) | `csf.nombre` |
| Apellido Paterno | `csf.apellido_paterno` |
| Apellido Materno | `csf.apellido_materno` |
| Fecha Nacimiento | (extraer de CURP o de datos del comprador) |
| RFC | `csf.rfc` |
| CURP | `csf.curp` |
| País de nacionalidad | "MEX" (México) |
| Actividad económica | "Bufetes jurídicos" u otra del CSF |

**Hoja: Domicilio Nacional**
| Campo | Valor Origen |
|-------|--------------|
| Código Postal | `csf.codigo_postal` |
| Estado | `csf.estado` |
| Municipio/Delegación | `csf.municipio` |
| Colonia | `csf.colonia` |
| Calle, avenida o vía | `csf.calle` |
| Número exterior | `csf.numero_exterior` |
| Número interior | `csf.numero_interior` |

---

## Funcionalidades a Implementar

### 1. Descarga de XML desde Badge
**Archivo:** `src/components/admin/FacturasTab.tsx`

**Cambios (líneas 847-856):**
- Convertir el Badge de XML en un botón clickeable
- Agregar función `handleDownloadXml(url: string)` que:
  - Detecte si es URL de Google Drive
  - Convierta de formato preview a download: 
    - De: `https://drive.google.com/file/d/{ID}/preview`
    - A: `https://drive.google.com/uc?export=download&id={ID}`
  - Abra la URL de descarga en nueva pestaña

```text
Badge actual → Button con onClick → Descarga el XML
```

### 2. Nuevo Componente: ValidarDatosFiscalesDialog
**Archivo nuevo:** `src/components/admin/ValidarDatosFiscalesDialog.tsx`

**Props:**
```typescript
interface ValidarDatosFiscalesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaCobranzaId: number;
  comprador: {
    id_persona: number;
    nombre_legal: string;
    rfc?: string;
  };
  xmlUrl: string;
  csfUrl?: string;  // URL de la constancia si ya existe
}
```

**Estructura del componente:**
```text
ValidarDatosFiscalesDialog
├── Header: "Validar Datos Fiscales para SAT"
├── Información del Comprador (nombre, RFC)
├── Estado de Documentos:
│   ├── XML: [URL disponible] + botón "Descargar"
│   └── CSF: [Subir archivo si no existe] o [Ver/Descargar]
├── Botón "Extraer y Comparar" (llama a n8n)
├── Loader mientras extrae
├── Tabla Comparativa de Resultados:
│   | Campo | XML | CSF | Estado |
│   | RFC | SASM491008LB8 | SASM491008LB8 | ✅ |
│   | Nombre | MARIO A... | MARIO A... | ✅ |
│   | C.P. | 44130 | 44130 | ✅ |
│   | Régimen | 605 | 605, 612 | ✅ |
├── Resumen: "4 de 4 campos coinciden"
└── Botón "Generar Excel SAT" (habilitado solo si todo ✅)
```

### 3. Servicio de Validación Fiscal
**Archivo nuevo:** `src/services/validacionFiscalService.ts`

**Funciones:**
```typescript
// Extraer datos llamando a n8n
async function extraerDatos(
  xmlUrl: string, 
  csfUrl: string, 
  cuentaId: number, 
  personaId: number
): Promise<ExtractionResult>

// Comparar campos y retornar resultado
function compararCampos(
  xmlData: XmlData, 
  csfData: CsfData
): ComparisonResult[]

// Generar Excel con los datos validados
async function generarExcelSAT(
  datos: DatosValidados, 
  cuentaInfo: CuentaInfo
): Promise<Blob>
```

### 4. Utilidad de Conversión de URL
**Archivo nuevo o en utils:** 

```typescript
function convertGoogleDriveUrl(url: string, action: 'download' | 'preview'): string {
  // Extraer ID del archivo de Google Drive
  const match = url.match(/\/d\/([^/]+)/);
  if (!match) return url;
  
  const fileId = match[1];
  
  if (action === 'download') {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
```

---

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `src/components/admin/ValidarDatosFiscalesDialog.tsx` | Diálogo principal de validación y comparación |
| `src/services/validacionFiscalService.ts` | Servicio para llamar n8n, comparar y generar Excel |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/FacturasTab.tsx` | Agregar onClick al badge XML para descarga directa |

---

## Flujo de Usuario Completo

```text
1. Usuario abre cuenta de cobranza 207
2. Va a pestaña "Facturas"
3. Ve tabla con comprador y sus documentos
4. Hace clic en badge "XML" verde → Se descarga el archivo XML
5. (Nuevo) Hace clic en botón "Validar SAT" en la fila del comprador
6. Se abre ValidarDatosFiscalesDialog
7. Sistema verifica que exista XML y CSF
8. Usuario hace clic en "Extraer y Comparar"
9. Sistema llama a n8n con las URLs
10. n8n descarga archivos, parsea y retorna JSON
11. Frontend muestra tabla comparativa con ✅/❌ por campo
12. Si todos coinciden: botón "Generar Excel SAT" se habilita
13. Usuario hace clic → Se descarga el .xlsm llenado
```

---

## Consideraciones Técnicas

### Manejo de URLs
- **Google Drive**: Convertir de `/preview` a `/uc?export=download`
- **Supabase Storage**: Usar URL directa (ya es descargable)

### Normalización de Comparación de Nombres
```typescript
function normalizarNombre(nombre: string): string {
  return nombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/\s+/g, " ")            // Espacios múltiples
    .trim();
}
```

### Validación de Régimen Fiscal
El XML contiene un solo código de régimen, pero la CSF puede tener múltiples. La comparación verifica que el código del XML exista en la lista del CSF:

```typescript
function validarRegimen(xmlRegimen: string, csfRegimenes: Array<{codigo: string}>): boolean {
  return csfRegimenes.some(r => r.codigo === xmlRegimen);
}
```

### Permisos
- La funcionalidad respeta los permisos existentes de `FacturasTab`
- El botón "Validar SAT" solo aparece si `duenoPuedeFacturar` es true y `!isReadOnly`

---

## Integración con Excel Template

El template `Presentacion_de_Aviso_al_SAT_Inmuebles_v4_5.xlsm` tiene macros VBA. Para llenarlo desde JavaScript se usará la librería `xlsx` o similar, escribiendo en las celdas específicas sin ejecutar macros (el usuario las ejecutará manualmente en Excel).

Celdas a llenar (aproximadas basadas en estructura del template):
- B3: RFC del emisor
- B4: Periodo AAAAMM
- B5: Referencia
- Fila 1 de Persona Física: Columnas B-I con datos del comprador
- Fila 1 de Domicilio Nacional: Columnas B-H con dirección
