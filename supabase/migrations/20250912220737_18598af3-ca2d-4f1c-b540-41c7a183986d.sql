-- Add foreign key constraints for address relationships in proyectos table

-- Add foreign key for direccion_id_pais to reference paises table
ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_direccion_id_pais 
FOREIGN KEY (direccion_id_pais) REFERENCES paises(id);

-- Add foreign key for direccion_id_estado to reference estados_mx table  
ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_direccion_id_estado 
FOREIGN KEY (direccion_id_estado) REFERENCES estados_mx(id);

-- Add foreign key for direccion_id_municipio to reference municipios_mx table
ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_direccion_id_municipio 
FOREIGN KEY (direccion_id_municipio) REFERENCES municipios_mx(id);