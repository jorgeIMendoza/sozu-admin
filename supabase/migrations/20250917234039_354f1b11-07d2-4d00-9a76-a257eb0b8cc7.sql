-- Create bancos table
CREATE TABLE public.bancos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on bancos table
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;

-- Create policy for bancos table
CREATE POLICY "Allow all access to bancos" 
ON public.bancos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert Mexican banks data
INSERT INTO public.bancos (nombre) VALUES
('BBVA México'),
('Santander México'),
('Banorte'),
('Citibanamex'),
('HSBC México'),
('Scotiabank México'),
('Inbursa'),
('Azteca'),
('Invex'),
('Mifel'),
('Actinver'),
('Ve por Más'),
('Banregio'),
('Afirme'),
('Intercam'),
('Multiva'),
('Autofin'),
('Bancoppel'),
('Banco Covalto'),
('Consubanco'),
('Sabadell México'),
('Pagatodo'),
('CIBanco'),
('Compartamos Banco'),
('Banco Finterra'),
('Nu México'),
('Klar'),
('Albo'),
('Hey Banco'),
('Stori Card');

-- Modify cuentas_bancarias table
-- Add new fields
ALTER TABLE public.cuentas_bancarias 
ADD COLUMN id_banco INTEGER,
ADD COLUMN cuenta_clabe TEXT,
ADD COLUMN cuenta_swift TEXT;

-- Create foreign key relationship
ALTER TABLE public.cuentas_bancarias 
ADD CONSTRAINT fk_cuentas_bancarias_banco 
FOREIGN KEY (id_banco) REFERENCES public.bancos(id);

-- Remove nombre_banco field
ALTER TABLE public.cuentas_bancarias 
DROP COLUMN nombre_banco;

-- Create trigger for bancos table timestamps
CREATE TRIGGER update_bancos_updated_at
BEFORE UPDATE ON public.bancos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();