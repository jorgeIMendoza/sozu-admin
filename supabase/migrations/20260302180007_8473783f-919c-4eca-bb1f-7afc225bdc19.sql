-- Invalidar PDFs de ofertas sin esquema de pago seleccionado para forzar regeneración
UPDATE ofertas
SET url = NULL
WHERE id_esquema_pago_seleccionado IS NULL
  AND url IS NOT NULL;