-- Agregar columna orden a esquemas_pago
ALTER TABLE public.esquemas_pago 
ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

-- Inicializar orden basado en el id (ascendente) por proyecto/producto
WITH ordered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(id_proyecto, 0), COALESCE(id_producto, 0), es_manual
      ORDER BY id ASC
    ) AS rn
  FROM public.esquemas_pago
  WHERE activo = true
)
UPDATE public.esquemas_pago ep
SET orden = ordered.rn
FROM ordered
WHERE ep.id = ordered.id;

-- Crear índice para mejorar performance de queries ordenadas
CREATE INDEX IF NOT EXISTS idx_esquemas_pago_orden 
ON public.esquemas_pago (id_proyecto, id_producto, orden);