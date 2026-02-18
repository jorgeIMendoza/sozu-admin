
CREATE OR REPLACE FUNCTION public.get_inventario_disponible(p_accessible_project_ids integer[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'propiedades', COALESCE((
        SELECT jsonb_agg(row_data ORDER BY (row_data->>'proyecto_nombre'), (row_data->>'edificio_nombre'), (row_data->>'numero_propiedad'))
        FROM (
          SELECT jsonb_build_object(
            'id', p.id,
            'numero_propiedad', p.numero_propiedad,
            'numero_piso', p.numero_piso,
            'precio_lista', p.precio_lista,
            'm2_interiores', p.m2_interiores,
            'm2_exteriores', p.m2_exteriores,
            'proyecto_id', pr.id,
            'proyecto_nombre', pr.nombre,
            'edificio_nombre', ed.nombre,
            'modelo_id', mo.id,
            'modelo_nombre', mo.nombre,
            'numero_recamaras', mo.numero_recamaras,
            'numero_completo_banos', mo.numero_completo_banos,
            'numero_medio_bano', mo.numero_medio_bano,
            'bodegas_count', COALESCE(bod.cnt, 0),
            'estacionamientos_count', COALESCE(est.cnt, 0),
            'estacionamientos_tipos', COALESCE(est.tipos, '[]'::jsonb),
            'propiedad_imagenes', COALESCE(pimg.imgs, '[]'::jsonb)
          ) AS row_data
          FROM propiedades p
          INNER JOIN edificios_modelos em ON em.id = p.id_edificio_modelo
          INNER JOIN edificios ed ON ed.id = em.id_edificio
          INNER JOIN proyectos pr ON pr.id = ed.id_proyecto
          INNER JOIN modelos mo ON mo.id = em.id_modelo
          LEFT JOIN LATERAL (
            SELECT count(*)::int AS cnt
            FROM bodegas b WHERE b.id_propiedad = p.id AND b.activo = true
          ) bod ON true
          LEFT JOIN LATERAL (
            SELECT count(*)::int AS cnt,
              jsonb_agg(DISTINCT te.nombre) FILTER (WHERE te.nombre IS NOT NULL) AS tipos
            FROM estacionamientos e
            LEFT JOIN tipos_estacionamiento te ON te.id = e.id_tipo
            WHERE e.id_propiedad = p.id AND e.activo = true
          ) est ON true
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(jsonb_build_object('id', mp.id, 'url', mp.url) ORDER BY mp.id) AS imgs
            FROM multimedias_propiedad mp
            WHERE mp.id_propiedad = p.id AND mp.activo = true AND mp.es_imagen = true
          ) pimg ON true
          WHERE p.id_estatus_disponibilidad = 2
            AND pr.activo = true
            AND pr.publicar = true
            AND (p_accessible_project_ids IS NULL OR pr.id = ANY(p_accessible_project_ids))
        ) sub
      ), '[]'::jsonb),
      'modelo_imagenes', COALESCE((
        SELECT jsonb_object_agg(modelo_id::text, imgs)
        FROM (
          SELECT DISTINCT mo.id AS modelo_id,
            (SELECT jsonb_agg(jsonb_build_object('id', mm.id, 'url', mm.url) ORDER BY mm.id)
             FROM multimedias_modelo mm
             WHERE mm.id_modelo = mo.id AND mm.activo = true AND mm.es_imagen = true AND mm.ver_como_imagen_de_propiedad = true
            ) AS imgs
          FROM propiedades p
          INNER JOIN edificios_modelos em ON em.id = p.id_edificio_modelo
          INNER JOIN edificios ed ON ed.id = em.id_edificio
          INNER JOIN proyectos pr ON pr.id = ed.id_proyecto
          INNER JOIN modelos mo ON mo.id = em.id_modelo
          WHERE p.id_estatus_disponibilidad = 2
            AND pr.activo = true AND pr.publicar = true
            AND (p_accessible_project_ids IS NULL OR pr.id = ANY(p_accessible_project_ids))
        ) unique_models
        WHERE imgs IS NOT NULL
      ), '{}'::jsonb),
      'esquemas_pago_proyecto', COALESCE((
        SELECT jsonb_object_agg(proyecto_id::text, schemes)
        FROM (
          SELECT DISTINCT pr.id AS proyecto_id,
            (SELECT jsonb_agg(jsonb_build_object(
              'id', s.id, 'nombre', s.nombre, 'id_proyecto', s.id_proyecto,
              'porcentaje_enganche', s.porcentaje_enganche,
              'porcentaje_mensualidades', s.porcentaje_mensualidades,
              'porcentaje_entrega', s.porcentaje_entrega,
              'numero_mensualidades', s.numero_mensualidades,
              'porcentaje_descuento_aumento', s.porcentaje_descuento_aumento
            ) ORDER BY s.nombre)
            FROM esquemas_pago s
            WHERE s.id_proyecto = pr.id AND s.activo = true AND s.es_manual = false
            ) AS schemes
          FROM propiedades p
          INNER JOIN edificios_modelos em ON em.id = p.id_edificio_modelo
          INNER JOIN edificios ed ON ed.id = em.id_edificio
          INNER JOIN proyectos pr ON pr.id = ed.id_proyecto
          WHERE p.id_estatus_disponibilidad = 2
            AND pr.activo = true AND pr.publicar = true
            AND (p_accessible_project_ids IS NULL OR pr.id = ANY(p_accessible_project_ids))
        ) unique_projects
        WHERE schemes IS NOT NULL
      ), '{}'::jsonb)
    )
  );
END;
$$;
