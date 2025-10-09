-- Rename direccion_calle_numero to direccion_calle
ALTER TABLE personas 
RENAME COLUMN direccion_calle_numero TO direccion_calle;

-- Rename direccion_fiscal_calle_numero to direccion_fiscal_calle
ALTER TABLE personas 
RENAME COLUMN direccion_fiscal_calle_numero TO direccion_fiscal_calle;

-- Add new address fields
ALTER TABLE personas 
ADD COLUMN direccion_num_int TEXT,
ADD COLUMN direccion_num_ext TEXT,
ADD COLUMN direccion_fiscal_num_int TEXT,
ADD COLUMN direccion_fiscal_num_ext TEXT;