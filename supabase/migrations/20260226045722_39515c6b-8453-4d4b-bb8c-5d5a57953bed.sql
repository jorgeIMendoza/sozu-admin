
CREATE OR REPLACE FUNCTION public.get_inventario_disponible_v2(
  p_accessible_project_ids integer[] DEFAULT NULL,
  p_project_names text[] DEFAULT NULL,
  p_model_names text[] DEFAULT NULL,
  p_bedrooms integer[] DEFAULT NULL,
  p_levels text[] DEFAULT NULL,
  p_has_bodega boolean DEFAULT NULL,
  p_has_estacionamiento boolean DEFAULT NULL,
  p_sort_price text DEFAULT NULL,
  p_page integer DEFAULT 0,
  p_page_size integer DEFAULT 30,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH accessible_projects AS (
    SELECT p.id, p.nombre
    FROM proyectos p
    WHERE p.activo = true
      AND (p_accessible_project_ids IS NULL OR p.id = ANY(p_accessible_project_ids))
  ),
  proyecto_edificios AS (
    SELECT e.id as edificio_id, e.id_proyecto, ap.nombre as proyecto_nombre
    FROM edificios e
    JOIN accessible_projects ap ON ap.id = e.id_proyecto
    WHERE e.activo = true
  ),
  edificio_modelos AS (
    SELECT em.id as edificio_modelo_id, em.id_edificio, em.id_modelo,
           pe.id_proyecto, pe.proyecto_nombre,
           e2.nombre as edificio_nombre
    FROM edificios_modelos em
    JOIN proyecto_edificios pe ON pe.edificio_id = em.id_edificio
    JOIN edificios e2 ON e2.id = em.id_edificio
  ),
  modelo_info AS (
    SELECT m.id, m.nombre, m.numero_recamaras, m.numero_completo_banos, m.numero_medio_bano
    FROM modelos m
    WHERE m.activo = true
  ),
  base_props AS (
    SELECT
      pr.id,
      pr.numero_propiedad,
      pr.numero_piso,
      pr.precio_lista,
      pr.m2_interiores,
      pr.m2_exteriores,
      em.id_proyecto as proyecto_id,
      em.proyecto_nombre,
      em.edificio_nombre,
      em.id_modelo as modelo_id,
      mi.nombre as modelo_nombre,
      mi.numero_recamaras,
      mi.numero_completo_banos,
      mi.numero_medio_bano,
      (SELECT count(*) FROM bodegas b WHERE b.id_propiedad = pr.id AND b.activo = true) as bodegas_count,
      (SELECT count(*) FROM estacionamientos est WHERE est.id_propiedad = pr.id AND est.activo = true) as estacionamientos_count,
      (SELECT array_agg(DISTINCT te.nombre)
       FROM estacionamientos est2
       JOIN tipos_estacionamiento te ON te.id = est2.id_tipo_estacionamiento
       WHERE est2.id_propiedad = pr.id AND est2.activo = true
      ) as estacionamientos_tipos,
      (SELECT jsonb_agg(jsonb_build_object('id', mm.id, 'url', mm.url) ORDER BY mm.id)
       FROM multimedias mm
       WHERE mm.id_propiedad = pr.id AND mm.activo = true
      ) as propiedad_imagenes
    FROM propiedades pr
    JOIN edificio_modelos em ON em.edificio_modelo_id = pr.id_edificio_modelo
    JOIN modelo_info mi ON mi.id = em.id_modelo
    WHERE pr.activo = true
      AND pr.es_aprobado = true
      AND pr.id_estatus_disponibilidad = 2
      AND (p_project_names IS NULL OR em.proyecto_nombre = ANY(p_project_names))
      AND (p_model_names IS NULL OR mi.nombre = ANY(p_model_names))
      AND (p_bedrooms IS NULL OR mi.numero_recamaras = ANY(p_bedrooms))
      AND (p_levels IS NULL OR pr.numero_piso = ANY(p_levels))
      AND (p_min_price IS NULL OR pr.precio_lista >= p_min_price)
      AND (p_max_price IS NULL OR pr.precio_lista <= p_max_price)
      AND (p_has_bodega IS NULL OR
           (p_has_bodega = true AND EXISTS (SELECT 1 FROM bodegas b WHERE b.id_propiedad = pr.id AND b.activo = true)) OR
           (p_has_bodega = false AND NOT EXISTS (SELECT 1 FROM bodegas b WHERE b.id_propiedad = pr.id AND b.activo = true)))
      AND (p_has_estacionamiento IS NULL OR
           (p_has_estacionamiento = true AND EXISTS (SELECT 1 FROM estacionamientos est WHERE est.id_propiedad = pr.id AND est.activo = true)) OR
           (p_has_estacionamiento = false AND NOT EXISTS (SELECT 1 FROM estacionamientos est WHERE est.id_propiedad = pr.id AND est.activo = true)))
  ),
  total AS (
    SELECT count(*) as cnt FROM base_props
  ),
  project_counts AS (
    SELECT jsonb_object_agg(proyecto_nombre, cnt) as counts
    FROM (SELECT proyecto_nombre, count(*) as cnt FROM base_props GROUP BY proyecto_nombre) sub
  ),
  filter_opts AS (
    SELECT jsonb_build_object(
      'proyectos', (SELECT coalesce(jsonb_agg(DISTINCT proyecto_nombre ORDER BY proyecto_nombre), '[]'::jsonb) FROM base_props),
      'modelos', (SELECT coalesce(jsonb_agg(DISTINCT modelo_nombre ORDER BY modelo_nombre), '[]'::jsonb) FROM base_props),
      'recamaras', (SELECT coalesce(jsonb_agg(DISTINCT numero_recamaras ORDER BY numero_recamaras), '[]'::jsonb) FROM base_props WHERE numero_recamaras IS NOT NULL),
      'niveles', (SELECT coalesce(jsonb_agg(DISTINCT numero_piso ORDER BY numero_piso), '[]'::jsonb) FROM base_props WHERE numero_piso IS NOT NULL)
    ) as opts
  ),
  modelo_imgs AS (
    SELECT em2.id_modelo,
           jsonb_agg(jsonb_build_object('id', mm2.id, 'url', mm2.url) ORDER BY mm2.id) as images
    FROM multimedias mm2
    JOIN edificios_modelos em2 ON em2.id = mm2.id_edificio_modelo
    WHERE mm2.activo = true
      AND em2.id_modelo IN (SELECT DISTINCT modelo_id FROM base_props)
    GROUP BY em2.id_modelo
  ),
  esquemas AS (
    SELECT ep.id_proyecto,
           jsonb_agg(jsonb_build_object(
             'id', ep.id,
             'nombre', ep.nombre,
             'porcentaje_enganche', ep.porcentaje_enganche,
             'porcentaje_mensualidades', ep.porcentaje_mensualidades,
             'porcentaje_entrega', ep.porcentaje_entrega,
             'numero_mensualidades', ep.numero_mensualidades,
             'porcentaje_descuento_aumento', ep.porcentaje_descuento_aumento
           ) ORDER BY ep.id) as schemes
    FROM esquemas_pago ep
    WHERE ep.activo = true
      AND ep.id_proyecto IN (SELECT DISTINCT proyecto_id FROM base_props)
    GROUP BY ep.id_proyecto
  ),
  sorted_props AS (
    SELECT * FROM base_props
    ORDER BY
      CASE WHEN p_sort_price = 'asc' THEN precio_lista END ASC NULLS LAST,
      CASE WHEN p_sort_price = 'desc' THEN precio_lista END DESC NULLS LAST,
      CASE WHEN p_sort_price IS NULL THEN random() END
    LIMIT p_page_size OFFSET p_page * p_page_size
  ),
  props_json AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', sp.id,
      'numero_propiedad', sp.numero_propiedad,
      'numero_piso', sp.numero_piso,
      'precio_lista', sp.precio_lista,
      'm2_interiores', sp.m2_interiores,
      'm2_exteriores', sp.m2_exteriores,
      'proyecto_id', sp.proyecto_id,
      'proyecto_nombre', sp.proyecto_nombre,
      'edificio_nombre', sp.edificio_nombre,
      'modelo_id', sp.modelo_id,
      'modelo_nombre', sp.modelo_nombre,
      'numero_recamaras', sp.numero_recamaras,
      'numero_completo_banos', sp.numero_completo_banos,
      'numero_medio_bano', sp.numero_medio_bano,
      'bodegas_count', sp.bodegas_count,
      'estacionamientos_count', sp.estacionamientos_count,
      'estacionamientos_tipos', sp.estacionamientos_tipos,
      'propiedad_imagenes', coalesce(sp.propiedad_imagenes, '[]'::jsonb)
    )), '[]'::jsonb) as props
    FROM sorted_props sp
  )
  SELECT jsonb_build_object(
    'propiedades', pj.props,
    'total_count', t.cnt,
    'project_counts', coalesce(pc.counts, '{}'::jsonb),
    'filter_options', fo.opts,
    'modelo_imagenes', coalesce((
      SELECT jsonb_object_agg(mi2.id_modelo::text, mi2.images)
      FROM modelo_imgs mi2
    ), '{}'::jsonb),
    'esquemas_pago_proyecto', coalesce((
      SELECT jsonb_object_agg(eq.id_proyecto::text, eq.schemes)
      FROM esquemas eq
    ), '{}'::jsonb)
  ) INTO result
  FROM props_json pj, total t, project_counts pc, filter_opts fo;

  RETURN result;
END;
$$;
