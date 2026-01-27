-- Deshabilitar trigger en propiedades (cuando cambia a estatus 9)
ALTER TABLE public.propiedades DISABLE TRIGGER on_property_pagada_completamente;

-- Deshabilitar trigger en documentos (cuando se sube factura o CSF)
ALTER TABLE public.documentos DISABLE TRIGGER on_document_insert_or_update_sat;