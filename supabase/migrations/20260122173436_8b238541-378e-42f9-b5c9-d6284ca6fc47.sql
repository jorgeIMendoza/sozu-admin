-- Migración para sincronizar numero_escritura desde documentos tipo 23 (Escritura)
-- hacia cuentas_cobranza.numero_escritura para registros existentes

UPDATE cuentas_cobranza cc
SET numero_escritura = d.numero
FROM documentos d
WHERE d.id_cuenta_cobranza = cc.id
  AND d.id_tipo_documento = 23
  AND d.activo = true
  AND d.numero IS NOT NULL
  AND d.numero != ''
  AND (cc.numero_escritura IS NULL OR cc.numero_escritura = '');