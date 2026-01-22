-- Habilitar pg_net para llamadas HTTP desde triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Función que verifica las 3 condiciones para notificación SAT
CREATE OR REPLACE FUNCTION public.check_sat_notification_conditions(
  p_cuenta_cobranza_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_propiedad_id INTEGER;
  v_estatus INTEGER;
  v_tiene_factura BOOLEAN;
  v_tiene_constancia BOOLEAN;
  v_tiene_archivo_sat BOOLEAN;
  v_webhook_url TEXT := 'https://n8n.sozu.mx/webhook/generaNotificacionSAT';
BEGIN
  -- 1. Obtener propiedad y estatus desde la cuenta de cobranza
  SELECT p.id, p.id_estatus_disponibilidad 
  INTO v_propiedad_id, v_estatus
  FROM public.cuentas_cobranza cc
  JOIN public.ofertas o ON cc.id_oferta = o.id
  JOIN public.propiedades p ON o.id_propiedad = p.id
  WHERE cc.id = p_cuenta_cobranza_id AND cc.activo = true;
  
  -- Si no encontramos la propiedad, salir
  IF v_propiedad_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 2. Verificar estatus = 9 (Pagada completamente)
  IF v_estatus IS NULL OR v_estatus <> 9 THEN
    RETURN FALSE;
  END IF;
  
  -- 3. Verificar existencia de factura activa (id_tipo_documento 21 o 22)
  SELECT EXISTS(
    SELECT 1 FROM public.documentos 
    WHERE id_cuenta_cobranza = p_cuenta_cobranza_id 
    AND id_tipo_documento IN (21, 22) 
    AND activo = true
  ) INTO v_tiene_factura;
  
  -- 4. Verificar constancia de situación fiscal (id_tipo_documento 6) de cualquier comprador
  SELECT EXISTS(
    SELECT 1 FROM public.documentos d
    JOIN public.compradores c ON d.id_persona = c.id_persona
    WHERE c.id_cuenta_cobranza = p_cuenta_cobranza_id 
    AND c.activo = true
    AND d.id_tipo_documento = 6 
    AND d.activo = true
  ) INTO v_tiene_constancia;
  
  -- 5. Verificar que NO exista archivo SAT previo activo (id_tipo_documento 44)
  SELECT EXISTS(
    SELECT 1 FROM public.documentos 
    WHERE id_cuenta_cobranza = p_cuenta_cobranza_id 
    AND id_tipo_documento = 44 
    AND activo = true
  ) INTO v_tiene_archivo_sat;
  
  -- 6. Si cumple todas las condiciones, llamar webhook de forma asíncrona
  IF v_tiene_factura AND v_tiene_constancia AND NOT v_tiene_archivo_sat THEN
    PERFORM extensions.http_post(
      url := v_webhook_url,
      body := json_build_object(
        'id_cuenta_cobranza', p_cuenta_cobranza_id,
        'timestamp', now()
      )::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function para cuando cambia el estatus de la propiedad a 9
CREATE OR REPLACE FUNCTION public.trigger_property_status_sat()
RETURNS TRIGGER AS $$
DECLARE
  v_cuenta_id INTEGER;
BEGIN
  -- Solo procesar si el nuevo estatus es 9 (Pagada completamente)
  -- y el anterior era diferente de 9
  IF NEW.id_estatus_disponibilidad = 9 AND 
     (OLD.id_estatus_disponibilidad IS NULL OR OLD.id_estatus_disponibilidad <> 9) THEN
    
    -- Buscar la cuenta de cobranza activa de esta propiedad
    SELECT cc.id INTO v_cuenta_id
    FROM public.cuentas_cobranza cc
    JOIN public.ofertas o ON cc.id_oferta = o.id
    WHERE o.id_propiedad = NEW.id AND cc.activo = true
    LIMIT 1;
    
    IF v_cuenta_id IS NOT NULL THEN
      PERFORM public.check_sat_notification_conditions(v_cuenta_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger en propiedades
DROP TRIGGER IF EXISTS on_property_pagada_completamente ON public.propiedades;
CREATE TRIGGER on_property_pagada_completamente
  AFTER UPDATE OF id_estatus_disponibilidad ON public.propiedades
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_property_status_sat();

-- Trigger function para cuando se inserta un documento tipo 6, 21 o 22
CREATE OR REPLACE FUNCTION public.trigger_document_insert_sat()
RETURNS TRIGGER AS $$
DECLARE
  v_cuenta_id INTEGER;
BEGIN
  -- Solo procesar documentos relevantes (constancia fiscal o facturas) y activos
  IF NEW.id_tipo_documento NOT IN (6, 21, 22) OR NEW.activo = false THEN
    RETURN NEW;
  END IF;
  
  -- Determinar la cuenta de cobranza
  IF NEW.id_cuenta_cobranza IS NOT NULL THEN
    v_cuenta_id := NEW.id_cuenta_cobranza;
  ELSIF NEW.id_persona IS NOT NULL THEN
    -- Buscar cuenta del comprador por persona
    SELECT c.id_cuenta_cobranza INTO v_cuenta_id
    FROM public.compradores c
    WHERE c.id_persona = NEW.id_persona AND c.activo = true
    ORDER BY c.fecha_creacion DESC
    LIMIT 1;
  END IF;
  
  IF v_cuenta_id IS NOT NULL THEN
    PERFORM public.check_sat_notification_conditions(v_cuenta_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger en documentos
DROP TRIGGER IF EXISTS on_document_insert_sat ON public.documentos;
CREATE TRIGGER on_document_insert_sat
  AFTER INSERT ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_document_insert_sat();