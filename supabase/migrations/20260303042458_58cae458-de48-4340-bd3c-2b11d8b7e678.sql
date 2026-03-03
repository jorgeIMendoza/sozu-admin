CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  IF to_jsonb(NEW) ? 'fecha_actualizacion' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('fecha_actualizacion', CURRENT_TIMESTAMP));
  ELSIF to_jsonb(NEW) ? 'updated_at' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_at', CURRENT_TIMESTAMP));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;