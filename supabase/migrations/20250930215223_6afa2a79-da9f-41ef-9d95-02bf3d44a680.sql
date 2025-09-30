-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trigger_verificar_venta_documento ON public.documentos;
DROP TRIGGER IF EXISTS trigger_verificar_venta_pago ON public.acuerdos_pago;

-- Mejorar la función verificar_propiedad_vendida con logging
CREATE OR REPLACE FUNCTION public.verificar_propiedad_vendida()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_propiedad_id INTEGER;
    tiene_contrato_verificado BOOLEAN := FALSE;
    tiene_enganche_pagado BOOLEAN := FALSE;
BEGIN
    -- Determine property ID based on triggering table
    IF TG_TABLE_NAME = 'documentos' THEN
        v_propiedad_id := NEW.id_propiedad;
        RAISE NOTICE 'Trigger ejecutado desde documentos para propiedad %', v_propiedad_id;
    ELSIF TG_TABLE_NAME = 'acuerdos_pago' THEN
        -- Get property ID through cuentas_cobranza -> ofertas -> propiedades
        SELECT o.id_propiedad INTO v_propiedad_id
        FROM acuerdos_pago ap
        JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE ap.id = NEW.id;
        
        RAISE NOTICE 'Trigger ejecutado desde acuerdos_pago para propiedad %', v_propiedad_id;
    END IF;

    -- Check if there's a verified "Contrato" (id_tipo_documento = 18)
    SELECT EXISTS(
        SELECT 1 
        FROM documentos 
        WHERE id_propiedad = v_propiedad_id 
        AND id_tipo_documento = 18 
        AND es_verificado = TRUE
        AND activo = TRUE
    ) INTO tiene_contrato_verificado;

    -- Check if there's a completed "Enganche" payment (id_concepto = 2)
    SELECT EXISTS(
        SELECT 1
        FROM acuerdos_pago ap
        JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE o.id_propiedad = v_propiedad_id
        AND ap.id_concepto = 2
        AND ap.pago_completado = TRUE
        AND ap.activo = TRUE
    ) INTO tiene_enganche_pagado;

    RAISE NOTICE 'Propiedad %: Contrato verificado = %, Enganche pagado = %', 
        v_propiedad_id, tiene_contrato_verificado, tiene_enganche_pagado;

    -- Only update to "Vendido" (id=5) if BOTH conditions are true
    IF tiene_contrato_verificado AND tiene_enganche_pagado THEN
        UPDATE propiedades 
        SET id_estatus_disponibilidad = 5
        WHERE id = v_propiedad_id;
        
        RAISE NOTICE 'Propiedad % actualizada a VENDIDO (id_estatus_disponibilidad=5)', v_propiedad_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- Crear trigger para la tabla documentos
CREATE TRIGGER trigger_verificar_venta_documento
AFTER INSERT OR UPDATE ON public.documentos
FOR EACH ROW
WHEN (NEW.id_tipo_documento = 18 AND NEW.es_verificado = TRUE AND NEW.activo = TRUE)
EXECUTE FUNCTION public.verificar_propiedad_vendida();

-- Crear trigger para la tabla acuerdos_pago
CREATE TRIGGER trigger_verificar_venta_pago
AFTER INSERT OR UPDATE ON public.acuerdos_pago
FOR EACH ROW
WHEN (NEW.id_concepto = 2 AND NEW.pago_completado = TRUE AND NEW.activo = TRUE)
EXECUTE FUNCTION public.verificar_propiedad_vendida();