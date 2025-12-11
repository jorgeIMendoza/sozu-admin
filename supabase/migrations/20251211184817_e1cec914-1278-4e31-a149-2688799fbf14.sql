-- Corregir URLs de CEP malformados en tabla pagos
-- Agregar el bucket 'ceps/' a los URLs que no lo tienen

UPDATE pagos 
SET url_cep = REPLACE(
  url_cep, 
  'https://tzmhgfjmddkfyffkkmto.supabase.co/storage/v1/object/public/',
  'https://tzmhgfjmddkfyffkkmto.supabase.co/storage/v1/object/public/ceps/'
),
fecha_actualizacion = CURRENT_TIMESTAMP
WHERE url_cep IS NOT NULL 
  AND url_cep LIKE 'https://tzmhgfjmddkfyffkkmto.supabase.co/storage/v1/object/public/%'
  AND url_cep NOT LIKE '%/public/ceps/%';