-- Modificar la función fn_insert_datos_cep para manejar conflictos con ON CONFLICT DO UPDATE
-- Esto permite que si un pago STP es eliminado y recargado, el registro CEP se actualice en lugar de fallar

CREATE OR REPLACE FUNCTION public.fn_insert_datos_cep()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_tipo_cep INT;
    cadena_original TEXT;
    fecha_str TEXT;
BEGIN
    -- Construir la cadena original
    fecha_str := TO_CHAR(NEW.fecha_operacion::date, 'YYYY-MM-DD');
    cadena_original := fecha_str || ',' || NEW.claverastreo || ',' || NEW.institucion_ordenante
                        || ',' || NEW.institucion_beneficiaria || ',' || NEW.cuenta_beneficiario
                        || ',' || NEW.monto;

    -- Determinar id_tipo_cep según clabe STP (cuenta_beneficiario)
    SELECT pago_de
    INTO v_id_tipo_cep
    FROM (
        SELECT 1 AS pago_de
        FROM propiedades p
        WHERE p.clabe_stp_tmp_apartado = NEW.cuenta_beneficiario
          AND p.activo = TRUE

        UNION ALL

        SELECT CASE
                 WHEN o.id_propiedad IS NOT NULL THEN 1
                 ELSE 2
               END AS pago_de
        FROM cuentas_cobranza cc
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE cc.clabe_stp = NEW.cuenta_beneficiario
          AND cc.activo = TRUE

        UNION ALL

        SELECT 3 AS pago_de
        FROM cuentas_cobranza cc
        WHERE cc.clabe_stp = NEW.cuenta_beneficiario
          AND cc.id_cuenta_cobranza_padre IS NOT NULL
          AND cc.activo = TRUE
    ) sub
    LIMIT 1;

    -- Insertar en tabla_datos_cep CON MANEJO DE CONFLICTOS
    INSERT INTO tabla_datos_cep (
        claverastreo,
        fecha_operacion,
        cadena,
        id_tipo_cep,
        fecha_creacion
    )
    VALUES (
        NEW.claverastreo,
        NEW.fecha_operacion::date,
        CASE
            WHEN SPLIT_PART(cadena_original, ',', 1) = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') THEN
                cadena_original
            ELSE
                TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') || ',' || SUBSTRING(cadena_original FROM POSITION(',' IN cadena_original)+1)
        END,
        COALESCE(v_id_tipo_cep, 4),
        CURRENT_DATE
    )
    ON CONFLICT (claverastreo) DO UPDATE SET
        fecha_operacion = EXCLUDED.fecha_operacion,
        cadena = EXCLUDED.cadena,
        id_tipo_cep = EXCLUDED.id_tipo_cep,
        fecha_creacion = EXCLUDED.fecha_creacion;

    RETURN NEW;
END;
$function$;