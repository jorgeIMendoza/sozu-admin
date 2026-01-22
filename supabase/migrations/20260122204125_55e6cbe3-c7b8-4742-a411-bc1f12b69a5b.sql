-- Drop and recreate with correct join path: edificios_modelos -> edificios -> id_proyecto
DROP FUNCTION IF EXISTS public.get_cuentas_cobranza_paginadas(integer,integer,text,text,text,text,text,text,text,integer[],text[],boolean,integer[],integer[]);

CREATE OR REPLACE FUNCTION public.get_cuentas_cobranza_paginadas(
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 50,
  p_id_cuenta text DEFAULT NULL,
  p_proyecto text DEFAULT NULL,
  p_clabe text DEFAULT NULL,
  p_no_propiedad text DEFAULT NULL,
  p_modelo text DEFAULT NULL,
  p_compradores text DEFAULT NULL,
  p_producto text DEFAULT NULL,
  p_estatus_ids integer[] DEFAULT NULL,
  p_tipos text[] DEFAULT NULL,
  p_activo boolean DEFAULT true,
  p_proyecto_ids integer[] DEFAULT NULL,
  p_dueno_entity_ids integer[] DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  clabe_stp text,
  fecha_compra timestamp with time zone,
  precio_final numeric,
  id_oferta integer,
  id_estatus_cuenta integer,
  activo boolean,
  fecha_creacion timestamp with time zone,
  porcentaje_comision_venta numeric,
  valor_uma numeric,
  proyecto text,
  id_proyecto integer,
  edificio text,
  modelo text,
  numero_propiedad text,
  id_propiedad integer,
  id_producto integer,
  producto text,
  estatus text,
  estatus_disponibilidad text,
  id_estatus_disponibilidad integer,
  vendedor text,
  id_vendedor integer,
  compradores jsonb,
  pagos_efectivo jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  
  -- Count total matching records
  SELECT COUNT(*) INTO v_total
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN propiedades prop ON o.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios edif ON em.id_edificio = edif.id
  LEFT JOIN productos_servicios ps ON o.id_producto = ps.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::text ILIKE '%' || p_id_cuenta || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_proyecto_ids IS NULL OR COALESCE(edif.id_proyecto, ps.id_proyecto) = ANY(p_proyecto_ids))
    AND (p_tipos IS NULL OR 
        (('Propiedad' = ANY(p_tipos) AND o.id_propiedad IS NOT NULL) OR
         ('Producto' = ANY(p_tipos) AND o.id_producto IS NOT NULL AND o.id_propiedad IS NULL) OR
         ('Servicio' = ANY(p_tipos) AND o.id_servicio IS NOT NULL)))
    AND (p_estatus_ids IS NULL OR cc.id_estatus_cuenta = ANY(p_estatus_ids));

  RETURN QUERY
  SELECT 
    cc.id,
    cc.clabe_stp,
    cc.fecha_compra,
    cc.precio_final,
    cc.id_oferta,
    cc.id_estatus_cuenta,
    cc.activo,
    cc.fecha_creacion,
    cc.porcentaje_comision_venta,
    cc.valor_uma,
    proy.nombre AS proyecto,
    COALESCE(edif.id_proyecto, ps.id_proyecto) AS id_proyecto,
    edif.nombre AS edificio,
    mod.nombre AS modelo,
    prop.numero_propiedad,
    prop.id AS id_propiedad,
    ps.id AS id_producto,
    ps.nombre AS producto,
    ec.nombre AS estatus,
    ed.nombre AS estatus_disponibilidad,
    prop.id_estatus_disponibilidad,
    pers_vend.nombre_legal AS vendedor,
    o.id_persona_lead AS id_vendedor,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre_legal', p.nombre_legal,
        'rfc', p.rfc,
        'email', p.email,
        'telefono', p.telefono,
        'porcentaje_participacion', oc.porcentaje_participacion
      ))
      FROM ofertas_compradores oc
      JOIN personas p ON oc.id_persona = p.id
      WHERE oc.id_oferta = o.id AND oc.activo = true
    ) AS compradores,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'fecha_pago', pag.fecha_pago,
        'monto', pag.monto
      ))
      FROM pagos pag
      WHERE pag.id_cuenta_cobranza = cc.id 
        AND pag.activo = true 
        AND pag.id_metodos_pago = 4
    ) AS pagos_efectivo,
    v_total AS total_count
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN propiedades prop ON o.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios edif ON em.id_edificio = edif.id
  LEFT JOIN modelos mod ON em.id_modelo = mod.id
  LEFT JOIN productos_servicios ps ON o.id_producto = ps.id
  LEFT JOIN proyectos proy ON COALESCE(edif.id_proyecto, ps.id_proyecto) = proy.id
  LEFT JOIN estatus_cuenta ec ON cc.id_estatus_cuenta = ec.id
  LEFT JOIN estado_disponibilidad ed ON prop.id_estatus_disponibilidad = ed.id
  LEFT JOIN personas pers_vend ON o.id_persona_lead = pers_vend.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::text ILIKE '%' || p_id_cuenta || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_proyecto IS NULL OR proy.nombre ILIKE '%' || p_proyecto || '%')
    AND (p_no_propiedad IS NULL OR prop.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR mod.nombre ILIKE '%' || p_modelo || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_proyecto_ids IS NULL OR COALESCE(edif.id_proyecto, ps.id_proyecto) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids))
    AND (p_tipos IS NULL OR 
        (('Propiedad' = ANY(p_tipos) AND o.id_propiedad IS NOT NULL) OR
         ('Producto' = ANY(p_tipos) AND o.id_producto IS NOT NULL AND o.id_propiedad IS NULL) OR
         ('Servicio' = ANY(p_tipos) AND o.id_servicio IS NOT NULL)))
    AND (p_estatus_ids IS NULL OR cc.id_estatus_cuenta = ANY(p_estatus_ids))
    AND (p_compradores IS NULL OR EXISTS (
      SELECT 1 FROM ofertas_compradores oc2
      JOIN personas p2 ON oc2.id_persona = p2.id
      WHERE oc2.id_oferta = o.id 
        AND oc2.activo = true
        AND (p2.nombre_legal ILIKE '%' || p_compradores || '%' OR p2.rfc ILIKE '%' || p_compradores || '%')
    ))
  ORDER BY cc.id DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;