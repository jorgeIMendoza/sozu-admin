-- Portal Bancos — solicitudes de crédito (pre-calificación) + SLA/tasas por banco.
-- Ver Ejecuciones_manuales/portal_bancos_solicitudes.md para el detalle.

-- ── 1. Columnas SLA + tasas en bancos_convenio ──
ALTER TABLE public.bancos_convenio
  ADD COLUMN IF NOT EXISTS dias_respuesta INTEGER,
  ADD COLUMN IF NOT EXISTS tasa_min NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS tasa_max NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS cat_min  NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS cat_max  NUMERIC(6,3);

COMMENT ON COLUMN public.bancos_convenio.dias_respuesta IS
  'SLA de respuesta del banco en días. NULL o <1 = selección definitiva (el cliente no puede cambiar). >=1 = la solicitud expira tras N días y el cliente puede cambiar.';
COMMENT ON COLUMN public.bancos_convenio.tasa_min IS
  'Tasa anual mínima (%) — fuente de la estimación. Mantener = tasa_desde. Si tasa_min/tasa_max son NULL el portal no muestra estimación.';

-- ── 2. Tabla bancos_solicitudes (lead de crédito) ──
CREATE TABLE IF NOT EXISTS public.bancos_solicitudes (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta_cobranza       BIGINT  NOT NULL REFERENCES public.cuentas_cobranza(id),
  id_banco                 INTEGER NOT NULL REFERENCES public.bancos(id),
  id_agente                INTEGER REFERENCES public.bancos_agentes(id),
  id_credito_hipotecario   BIGINT  REFERENCES public.creditos_hipotecarios(id),
  monto_financiar          NUMERIC(14,2) NOT NULL,
  plazo_anios              SMALLINT      NOT NULL,
  -- Lo que pidió el cliente (estimación referencial)
  mensualidad_estimada_min NUMERIC(14,2),
  mensualidad_estimada_max NUMERIC(14,2),
  tasa_estimada_min        NUMERIC(6,3),
  tasa_estimada_max        NUMERIC(6,3),
  cat_estimado_min         NUMERIC(6,3),
  cat_estimado_max         NUMERIC(6,3),
  -- Propuesta del banco / acuerdo mutuo (lo llena el portal del banco)
  monto_aprobado           NUMERIC(14,2),
  plazo_aprobado_anios     SMALLINT,
  tasa_aprobada            NUMERIC(6,3),
  cat_aprobado             NUMERIC(6,3),
  mensualidad_aprobada     NUMERIC(14,2),
  notas_banco              TEXT,
  fecha_respuesta_banco    TIMESTAMPTZ,   -- cuando el banco emitió su propuesta
  acuerdo_aceptado_cliente BOOLEAN NOT NULL DEFAULT false,
  fecha_acuerdo            TIMESTAMPTZ,    -- cuando el cliente aceptó → acuerdo mutuo
  estatus                  TEXT NOT NULL DEFAULT 'nuevo'
                             CHECK (estatus IN (
                               'nuevo','asignado','contactado','en_evaluacion',
                               'pre_aprobado','oferta_vinculante','en_coordinacion',
                               'formalizado','rechazado','desistido','expirada')),
  motivo_cierre            TEXT,
  dias_respuesta_snapshot  INTEGER,
  fecha_expiracion         TIMESTAMPTZ,
  notificado_expiracion    BOOLEAN NOT NULL DEFAULT false,
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  fecha_consentimiento     TIMESTAMPTZ,
  fecha_envio              TIMESTAMPTZ NOT NULL DEFAULT now(),
  activo                   BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion           TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bancos_solicitudes_cuenta     ON public.bancos_solicitudes (id_cuenta_cobranza);
CREATE INDEX IF NOT EXISTS idx_bancos_solicitudes_banco      ON public.bancos_solicitudes (id_banco);
CREATE INDEX IF NOT EXISTS idx_bancos_solicitudes_estatus    ON public.bancos_solicitudes (estatus) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_bancos_solicitudes_expiracion ON public.bancos_solicitudes (fecha_expiracion) WHERE activo AND fecha_expiracion IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bancos_solicitudes_vigente
  ON public.bancos_solicitudes (id_cuenta_cobranza)
  WHERE activo AND estatus NOT IN ('rechazado','desistido','expirada','formalizado');

-- ── 3. Trigger fecha_actualizacion ──
DROP TRIGGER IF EXISTS update_bancos_solicitudes_updated_at ON public.bancos_solicitudes;
CREATE TRIGGER update_bancos_solicitudes_updated_at
  BEFORE UPDATE ON public.bancos_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 4. RLS por dueño ──
-- Staff interno (rol NO en 23,28) ve todo. Cliente (23) solo sus cuentas.
-- Banco (28): SIN acceso todavía — no existe columna usuarios.id_banco_asociado
-- ni el portal del banco. Cuando existan, agregar la rama comentada abajo para
-- acotar al banco a sus propias solicitudes (id_banco). Fail-closed hasta entonces.
ALTER TABLE public.bancos_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bancos_solicitudes_rw ON public.bancos_solicitudes;
CREATE POLICY bancos_solicitudes_rw ON public.bancos_solicitudes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_user_id = (SELECT auth.uid())
        AND (
          u.rol_id NOT IN (23, 28)                     -- staff interno ve todo
          OR (                                          -- cliente: solo sus cuentas
            u.rol_id = 23
            AND u.id_persona IN (
              SELECT o.id_persona_lead
              FROM public.cuentas_cobranza cc
              JOIN public.ofertas o ON o.id = cc.id_oferta
              WHERE cc.id = bancos_solicitudes.id_cuenta_cobranza
            )
          )
          -- OR (u.rol_id = 28 AND bancos_solicitudes.id_banco = u.id_banco_asociado)  -- banco: solo lo suyo (pendiente)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_user_id = (SELECT auth.uid())
        AND (
          u.rol_id NOT IN (23, 28)
          OR (
            u.rol_id = 23
            AND u.id_persona IN (
              SELECT o.id_persona_lead
              FROM public.cuentas_cobranza cc
              JOIN public.ofertas o ON o.id = cc.id_oferta
              WHERE cc.id = bancos_solicitudes.id_cuenta_cobranza
            )
          )
          -- OR (u.rol_id = 28 AND bancos_solicitudes.id_banco = u.id_banco_asociado)  -- banco (pendiente)
        )
    )
  );

-- ── 5. Seed de tasas + SLA de los 3 bancos aliados (para que se muestre estimación) ──
UPDATE public.bancos_convenio SET tasa_desde=9.15, tasa_min=9.15, tasa_max=11.20, cat_min=13.0, cat_max=13.4, dias_respuesta=7 WHERE id_banco=1; -- BBVA
UPDATE public.bancos_convenio SET tasa_desde=8.85, tasa_min=8.85, tasa_max=10.65, cat_min=10.7, cat_max=12.6, dias_respuesta=7 WHERE id_banco=2; -- Santander
UPDATE public.bancos_convenio SET tasa_desde=9.15, tasa_min=9.15, tasa_max=11.20, cat_min=12.4, cat_max=13.1, dias_respuesta=7 WHERE id_banco=3; -- Banorte
