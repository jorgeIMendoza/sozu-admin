-- Paso 1: Corrección Caso 1 - De "Pagada completamente" (9) a "Vendido" (5)
-- Propiedades con estatus 9 que tienen saldo pendiente > 0
UPDATE propiedades p
SET id_estatus_disponibilidad = 5
FROM (
    SELECT 
        p.id,
        COALESCE(
            (SELECT SUM(ap.monto) FROM acuerdos_pago ap 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             JOIN ofertas o ON cc.id_oferta = o.id
             WHERE o.id_propiedad = p.id AND ap.activo = true AND cc.activo = true),
            0
        ) - COALESCE(
            (SELECT SUM(apl.monto) FROM aplicaciones_pago apl 
             JOIN acuerdos_pago ap ON apl.id_acuerdo_pago = ap.id 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             JOIN ofertas o ON cc.id_oferta = o.id
             WHERE o.id_propiedad = p.id AND apl.activo = true AND ap.activo = true AND cc.activo = true),
            0
        ) as restante
    FROM propiedades p
    WHERE p.id_estatus_disponibilidad = 9 
    AND p.activo = true
) calc
WHERE p.id = calc.id
AND calc.restante > 0;

-- Paso 2: Corrección Caso 2 - De "Vendido" (5) a "Pagada completamente" (9)
-- Propiedades con estatus 5, con cuentas de cobranza, y saldo <= 0
UPDATE propiedades p
SET id_estatus_disponibilidad = 9
FROM (
    SELECT 
        p.id,
        COALESCE(
            (SELECT SUM(ap.monto) FROM acuerdos_pago ap 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             JOIN ofertas o ON cc.id_oferta = o.id
             WHERE o.id_propiedad = p.id AND ap.activo = true AND cc.activo = true),
            0
        ) - COALESCE(
            (SELECT SUM(apl.monto) FROM aplicaciones_pago apl 
             JOIN acuerdos_pago ap ON apl.id_acuerdo_pago = ap.id 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             JOIN ofertas o ON cc.id_oferta = o.id
             WHERE o.id_propiedad = p.id AND apl.activo = true AND ap.activo = true AND cc.activo = true),
            0
        ) as restante
    FROM propiedades p
    WHERE p.id_estatus_disponibilidad = 5 
    AND p.activo = true
    AND EXISTS (
        SELECT 1 FROM cuentas_cobranza cc
        JOIN ofertas o ON cc.id_oferta = o.id
        WHERE o.id_propiedad = p.id AND cc.activo = true
    )
) calc
WHERE p.id = calc.id
AND calc.restante <= 0;