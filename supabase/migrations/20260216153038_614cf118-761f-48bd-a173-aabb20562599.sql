
-- Insert new document type for Sozu commission invoices (category 11 = comision, like tipo 46)
INSERT INTO public.tipos_documento (id, nombre, activo, fecha_creacion, fecha_actualizacion, id_categoria_documento, asignado_a)
VALUES (47, 'Factura de comision de venta Sozu', true, now(), now(), 11, 'comision')
ON CONFLICT (id) DO NOTHING;

-- Add column to track the Sozu commission invoice document on cuentas_cobranza
ALTER TABLE public.cuentas_cobranza
ADD COLUMN IF NOT EXISTS id_documento_factura_comision_sozu integer REFERENCES public.documentos(id);
