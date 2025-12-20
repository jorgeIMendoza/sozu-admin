-- Insertar el reporte de Estado de Cuenta de Propiedades
INSERT INTO public.reportes (
  nombre,
  descripcion,
  query_sql,
  filtros_configuracion,
  nombre_archivo,
  id_submenu,
  activo
)
VALUES (
  'Estado de Cuenta por Propiedad',
  'Listado de propiedades con compradores, dueño vendedor, precio final, montos a pagar y pagados durante la obra y a la entrega. Incluye sumatorias.',
  $$
  SELECT 
    pr.nombre AS proyecto,
    p.numero_propiedad AS numero_departamento,
    COALESCE(comprador.nombre_legal, 'Sin comprador') AS comprador,
    COALESCE(dueno.nombre_legal, 'Sin dueño') AS dueno_vendedor,
    cc.precio_final,
    
    -- Monto a pagar durante la obra (conceptos 1,2,4,5,6)
    COALESCE((
      SELECT SUM(ap.monto)
      FROM acuerdos_pago ap
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND ap.id_concepto IN (1, 2, 4, 5, 6)
    ), 0) AS monto_durante_obra,
    
    -- Monto a pagar a la entrega (concepto 3)
    COALESCE((
      SELECT SUM(ap.monto)
      FROM acuerdos_pago ap
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND ap.id_concepto = 3
    ), 0) AS monto_a_la_entrega,
    
    -- Pagado durante la obra
    COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND aplp.activo = true
        AND ap.id_concepto IN (1, 2, 4, 5, 6)
    ), 0) AS pagado_durante_obra,
    
    -- Pagado a la entrega
    COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND aplp.activo = true
        AND ap.id_concepto = 3
    ), 0) AS pagado_a_la_entrega,
    
    -- Restante durante la obra
    COALESCE((
      SELECT SUM(ap.monto)
      FROM acuerdos_pago ap
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND ap.id_concepto IN (1, 2, 4, 5, 6)
    ), 0) - COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND aplp.activo = true
        AND ap.id_concepto IN (1, 2, 4, 5, 6)
    ), 0) AS restante_durante_obra,
    
    -- Restante a la entrega
    COALESCE((
      SELECT SUM(ap.monto)
      FROM acuerdos_pago ap
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND ap.id_concepto = 3
    ), 0) - COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND aplp.activo = true
        AND ap.id_concepto = 3
    ), 0) AS restante_a_la_entrega
    
  FROM cuentas_cobranza cc
  JOIN propiedades p ON cc.id_propiedad = p.id
  JOIN edificios_modelos em ON p.id_edificio_modelo = em.id
  JOIN edificios e ON em.id_edificio = e.id
  JOIN proyectos pr ON e.id_proyecto = pr.id
  LEFT JOIN personas comprador ON cc.id_comprador = comprador.id
  LEFT JOIN personas dueno ON p.id_persona_dueno = dueno.id
  WHERE cc.activo = true
    AND cc.id_tipo_cuenta = 1
    {{AND pr.id = :id_proyecto}}
    {{AND p.id_persona_dueno = :id_dueno}}
  ORDER BY pr.nombre, p.numero_propiedad
  $$,
  '[
    {
      "nombre": "id_proyecto",
      "label": "Proyecto",
      "tipo": "select",
      "tabla": "proyectos",
      "campo_valor": "id",
      "campo_label": "nombre",
      "requerido": false
    },
    {
      "nombre": "id_dueno",
      "label": "Dueño Vendedor",
      "tipo": "select",
      "depende_de": "id_proyecto",
      "tabla_dinamica": "personas",
      "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal FROM personas pe JOIN propiedades p ON p.id_persona_dueno = pe.id JOIN edificios_modelos em ON p.id_edificio_modelo = em.id JOIN edificios e ON em.id_edificio = e.id WHERE e.id_proyecto = :id_proyecto AND pe.activo = true ORDER BY pe.nombre_legal",
      "requerido": false
    }
  ]'::jsonb,
  'estado_cuenta_propiedades',
  41,
  true
);