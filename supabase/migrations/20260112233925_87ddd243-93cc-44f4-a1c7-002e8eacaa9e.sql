-- Eliminar el constraint que requiere evidencia obligatoria
ALTER TABLE public.comisionistas DROP CONSTRAINT IF EXISTS chk_comisionistas_pagos_coherencia;

-- Crear nuevo constraint que solo requiere que esté aprobada para ser pagada (sin requerir evidencia)
ALTER TABLE public.comisionistas ADD CONSTRAINT chk_comisionistas_pagos_coherencia 
CHECK (
  (pagada = false) OR 
  (pagada = true AND aprobada = true)
);