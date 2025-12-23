-- Update Report 2 (Productos) - use query_opciones instead of tabla for id_proyecto
-- This ensures only projects WITH PRODUCTS are shown in the filter
UPDATE reportes 
SET filtros_configuracion = '[
  {
    "nombre": "id_proyecto",
    "label": "Proyecto",
    "tipo": "select",
    "query_opciones": "SELECT DISTINCT pr.id, pr.nombre FROM proyectos pr JOIN productos_servicios ps ON ps.id_proyecto = pr.id JOIN ofertas o ON o.id_producto = ps.id JOIN cuentas_cobranza cc ON cc.id_oferta = o.id WHERE cc.activo = true AND cc.id_tipo_cancelacion IS NULL AND ps.activo = true AND pr.activo = true ORDER BY pr.nombre",
    "requerido": false
  },
  {
    "nombre": "id_dueno",
    "label": "Dueño vendedor",
    "tipo": "select",
    "depende_de": "id_proyecto",
    "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal as nombre FROM productos_servicios ps JOIN entidades_relacionadas er ON ps.id_entidad_relacionada_dueno = er.id JOIN personas pe ON er.id_persona = pe.id WHERE ps.id_proyecto = :id_proyecto AND ps.activo = true AND er.activo = true ORDER BY pe.nombre_legal",
    "requerido": false
  },
  {
    "nombre": "id_categoria",
    "label": "Categoría",
    "tipo": "select",
    "tabla": "categorias_producto",
    "campo_valor": "id",
    "campo_label": "nombre",
    "requerido": false
  }
]'::jsonb
WHERE id = 2;

-- Update Report 3 (Unificado) - use query_opciones for id_proyecto that includes BOTH properties and products
UPDATE reportes 
SET filtros_configuracion = '[
  {
    "nombre": "id_proyecto",
    "label": "Proyecto",
    "tipo": "select",
    "query_opciones": "SELECT DISTINCT pr.id, pr.nombre FROM proyectos pr WHERE pr.activo = true AND (EXISTS (SELECT 1 FROM cuentas_cobranza cc JOIN ofertas o ON cc.id_oferta = o.id JOIN propiedades p ON o.id_propiedad = p.id JOIN edificios_modelos em ON p.id_edificio_modelo = em.id JOIN edificios e ON em.id_edificio = e.id WHERE e.id_proyecto = pr.id AND cc.activo = true AND cc.id_tipo_cancelacion IS NULL AND o.id_producto IS NULL) OR EXISTS (SELECT 1 FROM cuentas_cobranza cc JOIN ofertas o ON cc.id_oferta = o.id JOIN productos_servicios ps ON o.id_producto = ps.id WHERE ps.id_proyecto = pr.id AND cc.activo = true AND cc.id_tipo_cancelacion IS NULL AND o.id_producto IS NOT NULL)) ORDER BY pr.nombre",
    "requerido": false
  },
  {
    "nombre": "id_dueno",
    "label": "Dueño Vendedor",
    "tipo": "select",
    "depende_de": "id_proyecto",
    "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal as nombre FROM personas pe WHERE pe.activo = true AND (EXISTS (SELECT 1 FROM entidades_relacionadas er JOIN propiedades p ON p.id_entidad_relacionada_dueno = er.id JOIN edificios_modelos em ON p.id_edificio_modelo = em.id JOIN edificios e ON em.id_edificio = e.id WHERE er.id_persona = pe.id AND e.id_proyecto = :id_proyecto) OR EXISTS (SELECT 1 FROM entidades_relacionadas er JOIN productos_servicios ps ON ps.id_entidad_relacionada_dueno = er.id WHERE er.id_persona = pe.id AND ps.id_proyecto = :id_proyecto)) ORDER BY pe.nombre_legal",
    "requerido": false
  },
  {
    "nombre": "tipo",
    "label": "Tipo",
    "tipo": "select",
    "opciones_estaticas": [
      {"id": "Propiedad", "nombre": "Propiedad"},
      {"id": "Producto", "nombre": "Producto"}
    ],
    "requerido": false
  },
  {
    "nombre": "id_categoria",
    "label": "Categoría de Producto",
    "tipo": "select",
    "query_opciones": "SELECT id, nombre FROM categorias_producto WHERE activo = true ORDER BY nombre",
    "requerido": false
  }
]'::jsonb
WHERE id = 3;