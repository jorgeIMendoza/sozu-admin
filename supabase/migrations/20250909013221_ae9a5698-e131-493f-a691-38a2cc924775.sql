-- Add concepto_pago and nombre_beneficiario columns to pagos_fake table
ALTER TABLE public.pagos_fake 
ADD COLUMN concepto_pago text,
ADD COLUMN nombre_beneficiario text;