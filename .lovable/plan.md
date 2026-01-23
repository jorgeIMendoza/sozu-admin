
# Plan: Actualizar Trigger para Detectar Actualizaciones de Documentos SAT

## Resumen

Actualizar el trigger de base de datos `on_document_insert_sat` para que también se ejecute cuando se actualiza un documento (cambio de comprador, verificación de estado, etc.), permitiendo que el sistema re-evalúe automáticamente las condiciones de notificación SAT.

## Cambios Propuestos

### 1. Actualizar la Función del Trigger

**Archivo**: Nueva migración SQL

La función `trigger_document_insert_sat` necesita manejar tanto INSERT como UPDATE. Actualmente solo revisa `NEW`, pero para UPDATE también debe considerar cambios relevantes:

- Cambio de `id_persona` (reasignación de comprador)
- Cambio de `id_estatus_verificacion` (documento verificado)
- Cambio de `activo` (documento activado/desactivado)

### 2. Recrear el Trigger con INSERT OR UPDATE

El trigger actual:
```sql
CREATE TRIGGER on_document_insert_sat
  AFTER INSERT ON public.documentos
  FOR EACH ROW
  WHEN (NEW.id_tipo_documento IN (6, 21, 22))
  EXECUTE FUNCTION public.trigger_document_insert_sat();
```

Se actualizará a:
```sql
CREATE TRIGGER on_document_insert_or_update_sat
  AFTER INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  WHEN (NEW.id_tipo_documento IN (6, 21, 22))
  EXECUTE FUNCTION public.trigger_document_insert_sat();
```

## Migración SQL

```sql
-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS on_document_insert_sat ON public.documentos;

-- Actualizar función para manejar INSERT y UPDATE
CREATE OR REPLACE FUNCTION public.trigger_document_insert_sat()
RETURNS TRIGGER AS $$
DECLARE
  v_cuenta_id INTEGER;
BEGIN
  -- Solo procesar documentos relevantes (constancia fiscal o facturas)
  IF NEW.id_tipo_documento NOT IN (6, 21, 22) THEN
    RETURN NEW;
  END IF;
  
  -- Para UPDATE, solo procesar si cambió algo relevante
  IF TG_OP = 'UPDATE' THEN
    -- Ignorar si no cambió nada importante
    IF OLD.id_persona = NEW.id_persona 
       AND OLD.id_estatus_verificacion = NEW.id_estatus_verificacion 
       AND OLD.activo = NEW.activo 
       AND OLD.id_cuenta_cobranza = NEW.id_cuenta_cobranza THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- Solo procesar si el documento está activo
  IF NEW.activo = false THEN
    RETURN NEW;
  END IF;
  
  -- Determinar la cuenta de cobranza
  IF NEW.id_cuenta_cobranza IS NOT NULL THEN
    v_cuenta_id := NEW.id_cuenta_cobranza;
  ELSIF NEW.id_persona IS NOT NULL THEN
    -- Buscar cuenta del comprador por persona
    SELECT c.id_cuenta_cobranza INTO v_cuenta_id
    FROM public.compradores c
    WHERE c.id_persona = NEW.id_persona AND c.activo = true
    LIMIT 1;
  END IF;
  
  IF v_cuenta_id IS NOT NULL THEN
    PERFORM public.check_sat_notification_conditions(v_cuenta_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear nuevo trigger para INSERT y UPDATE
CREATE TRIGGER on_document_insert_or_update_sat
  AFTER INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  WHEN (NEW.id_tipo_documento IN (6, 21, 22))
  EXECUTE FUNCTION public.trigger_document_insert_sat();
```

## Comportamiento Esperado

| Acción | Trigger se ejecuta | Resultado |
|--------|-------------------|-----------|
| Subir nueva factura PDF/XML | Sí | Evalúa condiciones SAT |
| Subir nueva constancia fiscal | Sí | Evalúa condiciones SAT |
| Verificar factura (cambio de estatus) | Sí | Evalúa condiciones SAT |
| Verificar constancia fiscal | Sí | Evalúa condiciones SAT |
| Reasignar factura a otro comprador | Sí | Evalúa condiciones SAT |
| Editar descripción de documento | No | Sin cambios relevantes |

## Flujo Completo

```text
Usuario actualiza documento
         ↓
   Trigger detecta UPDATE
         ↓
  ¿Cambió algo relevante?
    (persona, verificación, activo)
         ↓
       [Sí]
         ↓
  check_sat_notification_conditions()
         ↓
  ¿Cumple todas las condiciones?
  (estatus=9, facturas verificadas, 
   constancias verificadas, sin archivo SAT previo)
         ↓
       [Sí]
         ↓
  Llama webhook N8N:
  /webhook/generaNotificacionSAT
```

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/[timestamp]_update_sat_trigger_for_updates.sql` | Migración para actualizar el trigger |

## Nota sobre el Botón UI

El botón SAT en la interfaz (`Pagos.tsx`) ya se actualiza dinámicamente cada vez que se abre el diálogo, porque el servicio `satNotificationService.getStatus()` consulta el estado actual de los documentos. Por lo tanto:

1. **Trigger automático**: Cuando se cumplen las condiciones, el webhook se ejecuta automáticamente
2. **Botón visible**: Al recargar la lista o abrir el diálogo, el botón aparecerá si las condiciones se cumplen
