-- Agregar campos booleanos para controlar la visualización individual de cada oferta
ALTER TABLE ofertas
ADD COLUMN IF NOT EXISTS mostrar_piso_en_oferta boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS mostrar_precio_m2_en_oferta boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS mostrar_seccion_efectivo_en_oferta boolean DEFAULT true;

-- Comentarios para documentar los campos
COMMENT ON COLUMN ofertas.mostrar_piso_en_oferta IS 'Controla si se muestra el piso en el PDF de esta oferta específica';
COMMENT ON COLUMN ofertas.mostrar_precio_m2_en_oferta IS 'Controla si se muestra el precio por m2 en el PDF de esta oferta específica';
COMMENT ON COLUMN ofertas.mostrar_seccion_efectivo_en_oferta IS 'Controla si se muestra la sección de pago en efectivo en el PDF de esta oferta específica';