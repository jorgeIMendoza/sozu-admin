-- Add id_cuenta_cobranza column to documentos table
ALTER TABLE documentos 
ADD COLUMN id_cuenta_cobranza integer,
ADD CONSTRAINT fk_documentos_cuenta_cobranza 
  FOREIGN KEY (id_cuenta_cobranza) 
  REFERENCES cuentas_cobranza(id);