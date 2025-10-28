-- Función para verificar si una multa está completamente pagada
CREATE OR REPLACE FUNCTION public.verificar_multa_completada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_monto_multa NUMERIC;
    v_suma_aplicaciones NUMERIC;
    v_id_multa INTEGER;
BEGIN
    -- Solo proceder si es una aplicación de pago de multa y está activa
    IF NEW.es_multa = FALSE OR NEW.activo = FALSE THEN
        RETURN NEW;
    END IF;

    -- Obtener el monto total de la multa y su ID
    SELECT m.monto, m.id
    INTO v_monto_multa, v_id_multa
    FROM multas m
    WHERE m.id_acuerdo_pago = NEW.id_acuerdo_pago
      AND m.activo = TRUE
    LIMIT 1;

    -- Si no existe la multa, salir
    IF v_monto_multa IS NULL THEN
        RAISE NOTICE 'No se encontró multa activa para id_acuerdo_pago=%', NEW.id_acuerdo_pago;
        RETURN NEW;
    END IF;

    -- Calcular la suma de todas las aplicaciones de pago para esta multa
    SELECT COALESCE(SUM(ap.monto), 0)
    INTO v_suma_aplicaciones
    FROM aplicaciones_pago ap
    WHERE ap.id_acuerdo_pago = NEW.id_acuerdo_pago
      AND ap.es_multa = TRUE
      AND ap.activo = TRUE;

    RAISE NOTICE 'Multa ID=%: Monto total=$%, Suma aplicaciones=$%', 
        v_id_multa, v_monto_multa, v_suma_aplicaciones;

    -- Si la suma de aplicaciones es mayor o igual al monto de la multa
    IF v_suma_aplicaciones >= v_monto_multa THEN
        -- Actualizar multas.es_pagada = TRUE
        UPDATE multas
        SET es_pagada = TRUE,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_acuerdo_pago = NEW.id_acuerdo_pago
          AND activo = TRUE;

        -- Actualizar acuerdos_pago.pago_completado = TRUE
        UPDATE acuerdos_pago
        SET pago_completado = TRUE,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = NEW.id_acuerdo_pago
          AND activo = TRUE;

        RAISE NOTICE 'Multa ID=% completamente pagada. Actualizado es_pagada y pago_completado a TRUE', 
            v_id_multa;
    ELSE
        RAISE NOTICE 'Multa ID=% aún no está completamente pagada. Falta: $%', 
            v_id_multa, v_monto_multa - v_suma_aplicaciones;
    END IF;

    RETURN NEW;
END;
$function$;

-- Crear el trigger (eliminando primero si existe)
DROP TRIGGER IF EXISTS trigger_verificar_multa_completada ON aplicaciones_pago;

CREATE TRIGGER trigger_verificar_multa_completada
    AFTER INSERT ON aplicaciones_pago
    FOR EACH ROW
    EXECUTE FUNCTION verificar_multa_completada();