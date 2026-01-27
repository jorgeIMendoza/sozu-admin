-- Desactivar documento de notificación SAT para cuenta 207 (para pruebas)
UPDATE public.documentos 
SET activo = false 
WHERE id_cuenta_cobranza = 207 
  AND id_tipo_documento = 44 
  AND activo = true;