-- Corregir filtros_configuracion del reporte para usar aliases correctos (id y nombre)
UPDATE reportes 
SET filtros_configuracion = '[
  {
    "nombre": "id_proyecto",
    "label": "Proyecto",
    "tipo": "select",
    "query_opciones": "SELECT DISTINCT pr.id, pr.nombre FROM proyectos pr WHERE pr.activo = true AND (EXISTS (SELECT 1 FROM propiedades p JOIN edificios_modelos em ON p.id_edificio_modelo = em.id JOIN edificios e ON em.id_edificio = e.id JOIN ofertas o ON o.id_propiedad = p.id JOIN cuentas_cobranza cc ON cc.id_oferta = o.id WHERE e.id_proyecto = pr.id AND cc.activo = true AND p.activo = true) OR EXISTS (SELECT 1 FROM productos_servicios ps JOIN ofertas o ON o.id_producto = ps.id JOIN cuentas_cobranza cc ON cc.id_oferta = o.id WHERE ps.id_proyecto = pr.id AND cc.activo = true AND ps.activo = true)) ORDER BY pr.nombre"
  },
  {
    "nombre": "id_dueno",
    "label": "Dueño/Aportante",
    "tipo": "select",
    "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal FROM entidades_relacionadas er JOIN personas pe ON er.id_persona = pe.id WHERE er.activo = true AND er.id_tipo_entidad IN (4, 15) ORDER BY pe.nombre_legal"
  },
  {
    "nombre": "tipo",
    "label": "Tipo",
    "tipo": "select",
    "opciones_estaticas": [
      {"id": "propiedad", "nombre": "Propiedades"},
      {"id": "producto", "nombre": "Productos"}
    ]
  }
]'::jsonb
WHERE id = 4;