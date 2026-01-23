
# Plan: Mejorar Validación SAT para Múltiples Compradores

## Problema Identificado

Para la cuenta de cobranza 207 (propiedad Margot 818):
- **Estatus actual**: 8 (Entregado) - El botón SAT solo aparece cuando el estatus es 9 (Pagada completamente)
- **Documentos disponibles**: Factura PDF, XML y Constancia de Situación Fiscal para Mario Alberto Salazar Rivas (todo verificado)

La lógica actual tiene las siguientes limitaciones:
1. Solo verifica que exista **al menos una** factura y constancia, sin validar por cada comprador
2. No muestra un desglose de requisitos por comprador cuando hay múltiples propietarios
3. No permite generar notificación parcial para los compradores que sí cumplen

## Cambios Propuestos

### 1. Actualizar SATNotificationService

**Archivo**: `src/services/satNotificationService.ts`

Modificar el servicio para:
- Devolver un arreglo `compradoresStatus` con el estado de cada comprador:
  ```typescript
  interface CompradorSATStatus {
    id_persona: number;
    nombre_legal: string;
    tieneFacturaPdf: boolean;
    facturaPdfVerificada: boolean;
    tieneFacturaXml: boolean;
    facturaXmlVerificada: boolean;
    tieneConstancia: boolean;
    constanciaVerificada: boolean;
    cumpleRequisitos: boolean;
  }
  ```
- Agregar campo `compradoresStatus: CompradorSATStatus[]` al resultado
- Actualizar la lógica de `canGenerate` para que sea `true` solo cuando **todos** los compradores cumplan

### 2. Actualizar SATNotificationDialog

**Archivo**: `src/components/admin/SATNotificationDialog.tsx`

Modificar el diálogo para:
- Mostrar un resumen general (estatus de la propiedad)
- Mostrar una sección colapsable/tabla para cada comprador con sus requisitos:
  - Nombre del comprador
  - Factura PDF ✓/✗
  - Factura XML ✓/✗  
  - Constancia de Situación Fiscal ✓/✗
- Resaltar en rojo los compradores que no cumplen todos los requisitos
- Mostrar badge indicando cuántos compradores cumplen (ej: "2/3 listos")

### 3. Agregar Modal de Detalle de Compradores (opcional)

Reutilizar el patrón existente de `CompradoresDetailDialog` para mostrar el estado SAT de cada comprador cuando el usuario hace clic en el badge "+X" (si hay múltiples).

## Flujo de Usuario Actualizado

```text
1. Usuario ve botón SAT (cuando estatus = 9)
2. Abre el diálogo SAT
3. Ve resumen general:
   - ✓ Propiedad Pagada Completamente
   - Compradores: 2/3 listos
4. Expande sección de compradores para ver detalle:
   ┌─────────────────────────────────────────────────┐
   │ Comprador          │ PDF │ XML │ CSF │ Estado  │
   ├─────────────────────────────────────────────────┤
   │ Mario Alberto S.   │  ✓  │  ✓  │  ✓  │ Listo   │
   │ Ana García López   │  ✓  │  ✗  │  ✓  │ Falta   │
   │ Juan Pérez M.      │  ✗  │  ✗  │  ✗  │ Falta   │
   └─────────────────────────────────────────────────┘
5. Botón "Generar" solo habilitado cuando todos tengan ✓
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/services/satNotificationService.ts` | Agregar lógica de validación por comprador |
| `src/components/admin/SATNotificationDialog.tsx` | Mostrar tabla/lista de compradores con sus requisitos |

## Detalles Técnicos

### Consulta de documentos por comprador

```sql
-- Facturas por comprador (id_tipo_documento: 21=XML, 22=PDF)
SELECT d.id_persona, d.id_tipo_documento, d.id_estatus_verificacion
FROM documentos d
WHERE d.id_cuenta_cobranza = :cuentaId
  AND d.id_tipo_documento IN (21, 22)
  AND d.activo = true
  AND d.es_draft = false

-- Constancias por comprador (id_tipo_documento: 6)
SELECT d.id_persona, d.id_estatus_verificacion
FROM documentos d
WHERE d.id_persona IN (:personaIds)
  AND d.id_tipo_documento = 6
  AND d.activo = true
```

### Lógica de validación

```typescript
// Para cada comprador verificar:
const compradorStatus = compradores.map(comprador => {
  const facturasPdf = facturas.filter(f => 
    f.id_persona === comprador.id_persona && f.id_tipo_documento === 22
  );
  const facturasXml = facturas.filter(f => 
    f.id_persona === comprador.id_persona && f.id_tipo_documento === 21
  );
  const constancias = constanciasData.filter(c => 
    c.id_persona === comprador.id_persona
  );
  
  return {
    id_persona: comprador.id_persona,
    nombre_legal: comprador.nombre_legal,
    tieneFacturaPdf: facturasPdf.length > 0,
    facturaPdfVerificada: facturasPdf.some(f => f.id_estatus_verificacion === 2),
    tieneFacturaXml: facturasXml.length > 0,
    facturaXmlVerificada: facturasXml.some(f => f.id_estatus_verificacion === 2),
    tieneConstancia: constancias.length > 0,
    constanciaVerificada: constancias.some(c => c.id_estatus_verificacion === 2),
    cumpleRequisitos: // todos los campos anteriores en true
  };
});

// canGenerate solo si TODOS cumplen
const canGenerate = estatusDisponibilidad === 9 && 
  compradorStatus.every(c => c.cumpleRequisitos);
```

## Nota Importante

El botón SAT actualmente solo aparece cuando `id_estatus_disponibilidad === 9`. Para la cuenta 207, el estatus es 8 ("Entregado"), por lo que el botón no aparecerá hasta que la propiedad pase a estatus 9 ("Pagada completamente"). Esto es comportamiento esperado según las reglas de negocio.
