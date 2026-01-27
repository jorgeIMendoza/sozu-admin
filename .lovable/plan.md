
# Plan: Corregir Propiedades de Bottura en Estatus Incorrecto

## Resumen del Problema

Se identificaron **9 propiedades de Bottura** que están en estatus "Escrituración" (7) pero tienen saldos pendientes significativos (entre $1.2M y $2.3M). Según las reglas de negocio, deberían estar en estatus "Vendido" (5).

### Propiedades Afectadas
| ID | No. Propiedad | Restante |
|----|---------------|----------|
| 4768 | 1004 | $1,272,882.60 |
| 4769 | 1005 | $1,272,882.60 |
| 4799 | 1207 | $1,918,076.66 |
| 4811 | 1305 | $2,293,506.46 |
| 4829 | 1409 | $1,650,726.65 |
| 4701 | 507 | $2,054,688.74 |
| 4715 | 607 | $2,067,731.60 |
| 4745 | 809 | $1,332,627.72 |
| 4760 | 910 | $1,359,635.35 |

### Causa Raíz
El trigger `actualizar_estatus_a_escrituracion` cambia propiedades de "Pagada completamente" (9) a "Escrituración" (7) cuando se capturan datos de escritura, **sin verificar que la cuenta realmente esté pagada**. Esto permitió que propiedades con saldo pendiente llegaran incorrectamente a estatus 7.

---

## Plan de Implementación

### Paso 1: Migración de Datos (Corrección Inmediata)
Crear una migración SQL para revertir estas 9 propiedades de "Escrituración" (7) a "Vendido" (5).

```text
supabase/migrations/[timestamp]_fix_bottura_escrituracion_status.sql
```

**SQL a ejecutar:**
- UPDATE propiedades SET id_estatus_disponibilidad = 5 WHERE id IN (4768, 4769, 4799, 4811, 4829, 4701, 4715, 4745, 4760)
- Agregar comentario explicativo de la corrección

### Paso 2: Prevención Futura (Modificar Trigger)
Actualizar el trigger `actualizar_estatus_a_escrituracion` para que valide el saldo real antes de permitir el cambio de estatus.

**Lógica a agregar:**
1. Calcular el saldo pendiente: `precio_final - SUM(pagos.monto)`
2. Solo permitir el cambio a "Escrituración" si el saldo es menor o igual a $0.01
3. Si hay saldo pendiente, NO cambiar el estatus y registrar un LOG de advertencia

### Paso 3: Validación Post-Migración
Después de ejecutar la migración:
- Verificar que las 9 propiedades estén en estatus "Vendido" (5)
- Confirmar que la lógica del trigger modificado funciona correctamente

---

## Sección Técnica

### Migración SQL Completa

```sql
-- Corrección de propiedades de Bottura que están en Escrituración (7)
-- pero tienen saldo pendiente significativo. Deben estar en Vendido (5).

-- Propiedades afectadas con sus saldos pendientes:
-- 4768 (1004): $1,272,882.60
-- 4769 (1005): $1,272,882.60
-- 4799 (1207): $1,918,076.66
-- 4811 (1305): $2,293,506.46
-- 4829 (1409): $1,650,726.65
-- 4701 (507):  $2,054,688.74
-- 4715 (607):  $2,067,731.60
-- 4745 (809):  $1,332,627.72
-- 4760 (910):  $1,359,635.35

UPDATE propiedades
SET 
  id_estatus_disponibilidad = 5,  -- Vendido
  fecha_actualizacion = CURRENT_TIMESTAMP
WHERE id IN (4768, 4769, 4799, 4811, 4829, 4701, 4715, 4745, 4760)
  AND id_estatus_disponibilidad = 7;  -- Solo las que están en Escrituración
```

### Trigger Mejorado

```sql
CREATE OR REPLACE FUNCTION public.actualizar_estatus_a_escrituracion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_id_propiedad BIGINT;
    v_estatus_actual INTEGER;
    v_saldo_pendiente NUMERIC;
    dato_actualizado BOOLEAN := FALSE;
BEGIN
    -- Detectar si se actualizó algún campo de escrituración
    IF (NEW.numero_escritura IS DISTINCT FROM OLD.numero_escritura) OR
       (NEW.libro IS DISTINCT FROM OLD.libro) OR
       (NEW.hoja IS DISTINCT FROM OLD.hoja) OR
       (NEW.numero_unidad_privativa IS DISTINCT FROM OLD.numero_unidad_privativa) OR
       (NEW.clave_catastral IS DISTINCT FROM OLD.clave_catastral) OR
       (NEW.fecha_escritura IS DISTINCT FROM OLD.fecha_escritura) THEN
        dato_actualizado := TRUE;
    END IF;

    IF NOT dato_actualizado THEN
        RETURN NEW;
    END IF;

    -- Obtener la propiedad relacionada y su estatus actual
    SELECT o.id_propiedad, p.id_estatus_disponibilidad
    INTO v_id_propiedad, v_estatus_actual
    FROM ofertas o
    JOIN propiedades p ON o.id_propiedad = p.id
    WHERE o.id = NEW.id_oferta
      AND o.id_producto IS NULL
      AND p.activo = TRUE;

    IF v_id_propiedad IS NULL OR v_estatus_actual IS NULL OR v_estatus_actual != 9 THEN
        RETURN NEW;
    END IF;

    -- NUEVA VALIDACIÓN: Verificar que la cuenta esté realmente pagada
    SELECT NEW.precio_final - COALESCE(SUM(p.monto), 0)
    INTO v_saldo_pendiente
    FROM pagos p
    WHERE p.id_cuenta_cobranza = NEW.id
      AND p.activo = true;

    -- Solo permitir el cambio si el saldo es <= $0.01
    IF v_saldo_pendiente > 0.01 THEN
        RAISE LOG 'Propiedad % NO actualizada a Escrituración: saldo pendiente $%', 
            v_id_propiedad, v_saldo_pendiente;
        RETURN NEW;
    END IF;

    -- Actualizar estatus a Escrituración
    UPDATE propiedades
    SET id_estatus_disponibilidad = 7,
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = v_id_propiedad
      AND id_estatus_disponibilidad = 9;

    RAISE NOTICE 'Propiedad % actualizada de PAGADA COMPLETAMENTE (9) a ESCRITURACIÓN (7)', v_id_propiedad;

    RETURN NEW;
END;
$$;
```

---

## Riesgos y Consideraciones

1. **Datos de escritura ya capturados**: Las propiedades pueden tener datos de escritura (libro, hoja, etc.) capturados. Al revertir a "Vendido", estos datos NO se pierden, solo se corrige el estatus.

2. **Proceso de escrituración en curso**: Si alguna de estas propiedades ya está en proceso de escrituración formal con notario, será necesario comunicar el cambio de estatus al equipo legal.

3. **Trigger SAT**: Los triggers de notificación SAT están actualmente deshabilitados, por lo que esta corrección no disparará notificaciones automáticas.

---

## Archivos a Modificar

1. **Nueva migración SQL** - Corrección de estatus de las 9 propiedades
2. **Nueva migración SQL** - Actualización del trigger con validación de saldo
