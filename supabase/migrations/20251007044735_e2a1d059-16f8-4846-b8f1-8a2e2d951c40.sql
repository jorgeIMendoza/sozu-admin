-- Crear función para sincronizar compradores con cónyuge
CREATE OR REPLACE FUNCTION public.sync_conyuge_compradores(p_id_persona INTEGER)
RETURNS TABLE(
    mensaje TEXT,
    cuentas_procesadas INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_id_conyuge INTEGER;
    v_cuenta_record RECORD;
    v_nuevo_porcentaje NUMERIC;
    v_existe_conyuge BOOLEAN;
    v_existe_persona_original BOOLEAN;
    v_contador INTEGER := 0;
BEGIN
    -- Obtener id_conyuge de la persona
    SELECT id_conyuge INTO v_id_conyuge
    FROM personas
    WHERE id = p_id_persona
      AND activo = true;

    -- Si no tiene cónyuge, retornar mensaje
    IF v_id_conyuge IS NULL THEN
        RETURN QUERY SELECT 
            'La persona no tiene cónyuge asignado'::TEXT,
            0::INTEGER;
        RETURN;
    END IF;

    -- Verificar que el cónyuge existe y está activo
    IF NOT EXISTS(
        SELECT 1 FROM personas 
        WHERE id = v_id_conyuge 
        AND activo = true
    ) THEN
        RETURN QUERY SELECT 
            'El cónyuge no existe o no está activo'::TEXT,
            0::INTEGER;
        RETURN;
    END IF;

    -- ====================================================================
    -- LOOP 1: Procesar cuentas donde la PERSONA ORIGINAL es compradora
    -- ====================================================================
    FOR v_cuenta_record IN
        SELECT 
            c.id_cuenta_cobranza,
            c.porcentaje_copropiedad
        FROM compradores c
        JOIN cuentas_cobranza cc ON c.id_cuenta_cobranza = cc.id
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE c.id_persona = p_id_persona
          AND c.activo = true
          AND cc.activo = true
          AND o.id_producto IS NULL  -- Solo propiedades
    LOOP
        -- Verificar si el cónyuge ya existe en esta cuenta
        SELECT EXISTS(
            SELECT 1 
            FROM compradores
            WHERE id_persona = v_id_conyuge
              AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
              AND activo = true
        ) INTO v_existe_conyuge;

        IF NOT v_existe_conyuge THEN
            -- Dividir el porcentaje actual
            v_nuevo_porcentaje := v_cuenta_record.porcentaje_copropiedad / 2;

            -- Actualizar el porcentaje de la persona original
            UPDATE compradores
            SET porcentaje_copropiedad = v_nuevo_porcentaje,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_persona = p_id_persona
              AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
              AND activo = true;

            -- Insertar el cónyuge con el otro 50%
            INSERT INTO compradores (
                id_cuenta_cobranza,
                id_persona,
                porcentaje_copropiedad,
                activo,
                fecha_creacion,
                fecha_actualizacion
            ) VALUES (
                v_cuenta_record.id_cuenta_cobranza,
                v_id_conyuge,
                v_nuevo_porcentaje,
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
            
            v_contador := v_contador + 1;
        END IF;
    END LOOP;

    -- ====================================================================
    -- LOOP 2: Procesar cuentas donde el CÓNYUGE es comprador
    -- ====================================================================
    FOR v_cuenta_record IN
        SELECT 
            c.id_cuenta_cobranza,
            c.porcentaje_copropiedad
        FROM compradores c
        JOIN cuentas_cobranza cc ON c.id_cuenta_cobranza = cc.id
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE c.id_persona = v_id_conyuge
          AND c.activo = true
          AND cc.activo = true
          AND o.id_producto IS NULL  -- Solo propiedades
    LOOP
        -- Verificar si la persona original ya existe en esta cuenta del cónyuge
        SELECT EXISTS(
            SELECT 1 
            FROM compradores
            WHERE id_persona = p_id_persona
              AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
              AND activo = true
        ) INTO v_existe_persona_original;

        IF NOT v_existe_persona_original THEN
            -- Dividir el porcentaje del cónyuge
            v_nuevo_porcentaje := v_cuenta_record.porcentaje_copropiedad / 2;

            -- Actualizar el porcentaje del cónyuge
            UPDATE compradores
            SET porcentaje_copropiedad = v_nuevo_porcentaje,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_persona = v_id_conyuge
              AND id_cuenta_cobranza = v_cuenta_record.id_cuenta_cobranza
              AND activo = true;

            -- Insertar la persona original con el otro 50%
            INSERT INTO compradores (
                id_cuenta_cobranza,
                id_persona,
                porcentaje_copropiedad,
                activo,
                fecha_creacion,
                fecha_actualizacion
            ) VALUES (
                v_cuenta_record.id_cuenta_cobranza,
                p_id_persona,
                v_nuevo_porcentaje,
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
            
            v_contador := v_contador + 1;
        END IF;
    END LOOP;

    -- Retornar resultado
    RETURN QUERY SELECT 
        format('Sincronización completada. %s cuentas procesadas.', v_contador)::TEXT,
        v_contador::INTEGER;
END;
$$;