-- Drop and recreate the get_properties_with_details function to include model name
DROP FUNCTION IF EXISTS public.get_properties_with_details();

CREATE OR REPLACE FUNCTION public.get_properties_with_details()
 RETURNS TABLE(id bigint, "dueño" text, numero_propiedad text, numero_piso integer, m2_reales numeric, precio_lista numeric, clabe_stp text, vista text, transaccion text, tipo_propiedad text, disponibilidad text, modelo text, activo boolean)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        per.nombre_legal as dueño,
        p.numero_propiedad,
        p.numero_piso,
        p.m2_reales,
        p.precio_lista,
        p.clabe_stp_tmp_apartado as clabe_stp,
        v.nombre as vista,
        tt.nombre as transaccion,
        tp.nombre as tipo_propiedad,
        ed.nombre as disponibilidad,
        m.nombre as modelo,
        p.activo
    FROM propiedades p
    JOIN entidades_relacionadas er ON p.id_entidad_relacionada_dueno = er.id
    JOIN personas per ON er.id_persona = per.id
    JOIN vistas v ON p.id_vista = v.id
    JOIN tipos_transaccion tt ON p.id_tipo_transaccion = tt.id
    JOIN tipos_propiedad tp ON p.id_tipo_propiedad = tp.id
    JOIN estatus_disponibilidad ed ON p.id_estatus_disponibilidad = ed.id
    JOIN edificios_modelos em ON p.id_edificio_modelo = em.id
    JOIN modelos m ON em.id_modelo = m.id
    ORDER BY p.numero_propiedad;
END;
$function$