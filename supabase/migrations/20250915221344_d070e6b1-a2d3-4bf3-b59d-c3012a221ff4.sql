-- Enable RLS on new tables
ALTER TABLE multimedias_propiedad ENABLE ROW LEVEL SECURITY;
ALTER TABLE propiedades_caracteristicas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multimedias_propiedad
CREATE POLICY "Allow all access to multimedias_propiedad" 
ON multimedias_propiedad 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create RLS policies for propiedades_caracteristicas
CREATE POLICY "Allow all access to propiedades_caracteristicas" 
ON propiedades_caracteristicas 
FOR ALL 
USING (true) 
WITH CHECK (true);