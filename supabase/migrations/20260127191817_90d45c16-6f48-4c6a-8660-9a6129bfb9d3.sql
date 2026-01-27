-- Rollback property 31897: Remove Omar Segura association and reset to Inventario

-- Disable acuerdo_pago for cuenta 1702
UPDATE acuerdos_pago SET activo = false WHERE id_cuenta_cobranza = 1702;

-- Disable comprador for cuenta 1702
UPDATE compradores SET activo = false WHERE id_cuenta_cobranza = 1702;

-- Disable cuenta_cobranza 1702
UPDATE cuentas_cobranza SET activo = false WHERE id = 1702;

-- Disable oferta 1719
UPDATE ofertas SET activo = false WHERE id = 1719;

-- Disable esquema_pago 918 if it's a manual one (created by assignment)
UPDATE esquemas_pago SET activo = false WHERE id = 918 AND es_manual = true;

-- Reset property 31897 to Inventario (status 1) to match the original state
UPDATE propiedades SET id_estatus_disponibilidad = 1 WHERE id = 31897;