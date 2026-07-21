-- Fix statement timeout (57014) en /admin/propiedades.
-- El count=exact del listado hacía seq scan + heap de ~54k filas; en cold cache
-- rebasaba statement_timeout (8s) -> 500 -> lista vacía.
-- Estos índices convierten el count en index-only scan y aceleran el rango de precio.
-- Sin CONCURRENTLY: corre dentro de la transacción del CI; lock breve (~1-2s) en 54k filas.

-- Count del listado -> index-only scan (activo, es_aprobado, id_tipo_propiedad).
-- Cubre además el idx_propiedades_activo_aprobado existente (no se dropea, fuera de scope).
CREATE INDEX IF NOT EXISTS idx_propiedades_listado
  ON public.propiedades (activo, es_aprobado, id_tipo_propiedad);

-- Rango de precio / ordenamiento por precio del set publicado.
CREATE INDEX IF NOT EXISTS idx_propiedades_precio_publicadas
  ON public.propiedades (precio_lista)
  WHERE activo AND es_aprobado;

-- Refresca estadísticas del planner (corrige estimaciones malas: count=estimated daba 1001 vs 53676).
ANALYZE public.propiedades;
