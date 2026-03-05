
CREATE TABLE public.inmob_kpi_mensual (
  id SERIAL PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  pipeline_total NUMERIC DEFAULT 0,
  pipeline_count INTEGER DEFAULT 0,
  ofertas_activas INTEGER DEFAULT 0,
  apartados INTEGER DEFAULT 0,
  ingresos_cobrados NUMERIC DEFAULT 0,
  por_cobrar NUMERIC DEFAULT 0,
  estimados NUMERIC DEFAULT 0,
  conversion_global NUMERIC DEFAULT 0,
  ticket_promedio NUMERIC DEFAULT 0,
  comision_prom_agente NUMERIC DEFAULT 0,
  tiempo_prom_cierre NUMERIC DEFAULT 0,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (persona_id, anio, mes)
);

ALTER TABLE public.inmob_kpi_mensual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own KPIs"
ON public.inmob_kpi_mensual
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can upsert their own KPIs"
ON public.inmob_kpi_mensual
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
