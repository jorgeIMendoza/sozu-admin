ALTER TABLE public.avisos
ADD COLUMN IF NOT EXISTS tipos_pago_notificables integer[] NOT NULL DEFAULT ARRAY[2,5,4,3]::integer[];

COMMENT ON COLUMN public.avisos.tipos_pago_notificables IS 'Conceptos de pago permitidos para disparar avisos. Defaults: 2=enganche, 5=parcialidad, 4=especial, 3=contraentrega.';