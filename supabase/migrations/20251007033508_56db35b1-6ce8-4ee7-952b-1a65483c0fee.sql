-- =====================================================
-- PARTE 1: Nueva función para trigger en tabla personas
-- =====================================================

-- Función que se ejecuta cuando se actualiza id_conyuge en personas
-- Busca todas las cuentas de propiedades donde la persona es compradora
-- y agrega automáticamente al cónyuge como comprador
CREATE OR REPLACE FUNCTION public.agregar_conyuge_en_todas_cuentas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cuenta_record RECORD;
    v_nuevo_porcentaje NUMERIC;
    v_existe_conyuge BOOLEAN;
BEGIN
    -- Solo proceder si se está asignando un cónyuge (nuevo valor no es NULL)
    IF NEW.id_conyuge IS NULL THEN
        RETURN NEW;
    END IF;

    -- Solo proceder si el cónyuge cambió (evitar ejecuciones innecesarias)
    IF OLD.id_conyuge IS NOT NULL AND OLD.id_conyuge = NEW.id_conyuge THEN
        RETURN NEW;
    END IF;

    -- Solo proceder si ambas personas están activas
    IF NEW.activo = false THEN
        RETURN NEW;
    END IF;

    -- Verificar que el cónyuge existe y está activo
    IF NOT EXISTS(
        SELECT 1 FROM personas 
        WHERE id = NEW.id_conyuge 
        AND activo = true
    ) THEN
        RETURN NEW;
    END IF;

    -- Buscar todas las cuentas de cobranza de PROPIEDADES donde esta persona es compradora activa
    FOR v_cuenta_record IN
        SELECT 
            c.id_cuenta_cobranza,
            c.porcentaje_copropiedad
        FROM compradores c
        JOIN cuentas_cobranza cc ON c.id_cuenta_cobranza = cc.id
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE c.id_persona = NEW.id
          AND c.activo = true
          AND cc.activo = true
          AND o.id_producto IS NULL  -- Solo propiedades, NO productos
    LOOP
        -- Calcular el nuevo porcentaje (mitad del actual)
        v_nuevo_porcentaje := v_cuenta_record.porcentaje_copropiedad / 2;

        -- Verificar si el cónyuge ya existe como comprador en esta cuenta
        SELECT EXISTS(
            SELECT 1 
            FROM compradores
            WHERE id_persona = NEW.id_conyuge
              AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
              AND activo = true
        ) INTO v_existe_conyuge;

        IF NOT v_existe_conyuge THEN
            -- Actualizar el porcentaje del comprador original a la mitad
            UPDATE compradores
            SET porcentaje_copropiedad = v_nuevo_porcentaje,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_persona = NEW.id
              AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
              AND activo = true;

            -- Insertar al cónyuge como nuevo comprador con la otra mitad
            INSERT INTO compradores (
                id_cuenta_cobranza,
                id_persona,
                porcentaje_copropiedad,
                activo,
                fecha_creacion,
                fecha_actualizacion
            ) VALUES (
                v_cuenta_record.id_cuenta_cobranza,
                NEW.id_conyuge,
                v_nuevo_porcentaje,
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.agregar_conyuge_en_todas_cuentas() IS 
'Agrega automáticamente al cónyuge como comprador en todas las cuentas de propiedades donde la persona es compradora activa. Se ejecuta cuando se actualiza id_conyuge en la tabla personas.';

-- =====================================================
-- PARTE 2: Crear el trigger en la tabla personas
-- =====================================================

DROP TRIGGER IF EXISTS trigger_personas_agregar_conyuge ON personas;

CREATE TRIGGER trigger_personas_agregar_conyuge
    AFTER UPDATE OF id_conyuge ON personas
    FOR EACH ROW
    EXECUTE FUNCTION public.agregar_conyuge_en_todas_cuentas();

COMMENT ON TRIGGER trigger_personas_agregar_conyuge ON personas IS 
'Trigger que agrega automáticamente al cónyuge como comprador en todas las cuentas de propiedades cuando se actualiza id_conyuge.';

-- =====================================================
-- PARTE 3: Script de migración one-time para casos existentes
-- =====================================================

-- Script para procesar todos los casos donde:
-- 1. Una persona tiene id_conyuge configurado
-- 2. Esa persona es compradora en cuentas de propiedades
-- 3. El cónyuge NO está todavía como comprador en esas cuentas

DO $$
DECLARE
    v_persona_record RECORD;
    v_cuenta_record RECORD;
    v_nuevo_porcentaje NUMERIC;
    v_existe_conyuge BOOLEAN;
    v_total_procesados INTEGER := 0;
    v_total_agregados INTEGER := 0;
BEGIN
    -- Buscar todas las personas activas que tienen cónyuge configurado
    FOR v_persona_record IN
        SELECT 
            p.id as persona_id,
            p.nombre_legal as persona_nombre,
            p.id_conyuge,
            pc.nombre_legal as conyuge_nombre
        FROM personas p
        JOIN personas pc ON p.id_conyuge = pc.id
        WHERE p.id_conyuge IS NOT NULL
          AND p.activo = true
          AND pc.activo = true
    LOOP
        v_total_procesados := v_total_procesados + 1;

        -- Buscar todas las cuentas de propiedades donde esta persona es compradora
        FOR v_cuenta_record IN
            SELECT 
                c.id_cuenta_cobranza,
                c.porcentaje_copropiedad,
                cc.id as cuenta_id
            FROM compradores c
            JOIN cuentas_cobranza cc ON c.id_cuenta_cobranza = cc.id
            JOIN ofertas o ON cc.id_oferta = o.id
            WHERE c.id_persona = v_persona_record.persona_id
              AND c.activo = true
              AND cc.activo = true
              AND o.id_producto IS NULL  -- Solo propiedades
        LOOP
            -- Verificar si el cónyuge ya existe en esta cuenta
            SELECT EXISTS(
                SELECT 1 
                FROM compradores
                WHERE id_persona = v_persona_record.id_conyuge
                  AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
                  AND activo = true
            ) INTO v_existe_conyuge;

            IF NOT v_existe_conyuge THEN
                -- Calcular nuevo porcentaje
                v_nuevo_porcentaje := v_cuenta_record.porcentaje_copropiedad / 2;

                -- Actualizar porcentaje del comprador original
                UPDATE compradores
                SET porcentaje_copropiedad = v_nuevo_porcentaje,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id_persona = v_persona_record.persona_id
                  AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
                  AND activo = true;

                -- Insertar al cónyuge
                INSERT INTO compradores (
                    id_cuenta_cobranza,
                    id_persona,
                    porcentaje_copropiedad,
                    activo,
                    fecha_creacion,
                    fecha_actualizacion
                ) VALUES (
                    v_cuenta_record.id_cuenta_cobranza,
                    v_persona_record.id_conyuge,
                    v_nuevo_porcentaje,
                    true,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                );

                v_total_agregados := v_total_agregados + 1;
            END IF;
        END LOOP;
    END LOOP;
END $$;