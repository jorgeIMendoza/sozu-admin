-- Corregir trigger que actualiza estatus de propiedad a "Pagada completamente"
-- Problema: Actualizaba basándose en total_pagado vs precio_final
-- Solución: Solo actualizar cuando TODOS los acuerdos estén completados

CREATE OR REPLACE FUNCTION public.actualizar_estatus_propiedad_pagada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id_cuenta_cobranza INTEGER;
  v_id_oferta INTEGER;
  v_id_propiedad BIGINT;
  v_total_acuerdos INTEGER;
  v_acuerdos_completados INTEGER;
  v_todos_completados BOOLEAN := FALSE;
BEGIN
  -- Obtener id_cuenta_cobranza desde el acuerdo de pago
  SELECT id_cuenta_cobranza INTO v_id_cuenta_cobranza
  FROM acuerdos_pago
  WHERE id = NEW.id_acuerdo_pago
    AND activo = true;

  IF v_id_cuenta_cobranza IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener id_oferta de la cuenta de cobranza
  SELECT id_oferta INTO v_id_oferta
  FROM cuentas_cobranza
  WHERE id = v_id_cuenta_cobranza
    AND activo = true;

  -- Si no hay oferta, salir
  IF v_id_oferta IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener id_propiedad desde la oferta
  SELECT id_propiedad INTO v_id_propiedad
  FROM ofertas
  WHERE id = v_id_oferta;

  -- Solo procesar si es una propiedad (no producto/servicio)
  IF v_id_propiedad IS NULL THEN
    RETURN NEW;
  END IF;

  -- 🔥 NUEVA LÓGICA: Verificar si TODOS los acuerdos están completados
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN pago_completado = true THEN 1 END) as completados
  INTO v_total_acuerdos, v_acuerdos_completados
  FROM acuerdos_pago
  WHERE id_cuenta_cobranza = v_id_cuenta_cobranza
    AND activo = true;

  -- Determinar si todos están completados
  v_todos_completados := (v_total_acuerdos > 0 AND v_total_acuerdos = v_acuerdos_completados);

  -- Solo actualizar a "Pagada completamente" si TODOS los acuerdos están completados
  IF v_todos_completados THEN
    UPDATE propiedades
    SET id_estatus_disponibilidad = 9  -- Pagada completamente
    WHERE id = v_id_propiedad
      AND id_estatus_disponibilidad != 9;  -- Solo si no está ya en ese estatus
    
    RAISE NOTICE 'Propiedad % actualizada a PAGADA COMPLETAMENTE (id_estatus_disponibilidad=9). Acuerdos completados: % de %', 
      v_id_propiedad, v_acuerdos_completados, v_total_acuerdos;
  ELSE
    RAISE LOG 'Propiedad %: Acuerdos completados: % de % - NO actualizar estatus', 
      v_id_propiedad, v_acuerdos_completados, v_total_acuerdos;
  END IF;

  RETURN NEW;
END;
$function$;

-- Comentario actualizado
COMMENT ON FUNCTION public.actualizar_estatus_propiedad_pagada() IS 
'Actualiza el estatus de una propiedad a "Pagada completamente" (9) solo cuando TODOS los acuerdos de pago activos están completados (pago_completado = TRUE). Se ejecuta en cada INSERT/UPDATE de aplicaciones_pago.';