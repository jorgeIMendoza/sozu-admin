## Objetivo

1. El link "Confirmar mi Email" del correo de registro de agente debe apuntar a `agentes.sozu.com` (no `inmobiliarias.sozu.com`).
2. El correo de credenciales (template Postmark `41353048`) para agentes debe mostrar `https://agentes.sozu.com/auth/login` como portal.
3. En cualquier ambiente que **no** sea producción (`VITE_ENVIRONMENT !== 'production'` en frontend, equivalente en edge functions), todos los hosts `admin.sozu.com`, `agentes.sozu.com`, `inmobiliarias.sozu.com`, `clientes.sozu.com` deben reemplazarse por sus variantes `*-dev.sozu.com`.

## Detalle por capa

### A) Frontend — helper centralizado de URLs por portal

Nuevo archivo `src/lib/portalUrls.ts` que exporta:

- `IS_PRODUCTION = ENVIRONMENT === 'production'` (lee `ENVIRONMENT` de `src/lib/config.ts`).
- `getPortalHost(portal: 'admin' | 'agentes' | 'inmobiliarias' | 'clientes'): string` que devuelve `https://<portal>.sozu.com` en prod y `https://<portal>-dev.sozu.com` en cualquier otro ambiente.
- Helpers `getPortalLoginUrl(portal)` y `getPortalChangePasswordUrl(portal)`.

Refactorizar para usar el helper:

- `src/pages/auth/ConfirmacionEmail.tsx` — `getPortalHost` local actualmente hardcodea `clientes.sozu.com` / `inmobiliarias.sozu.com`. Cambiarlo para mapear:
  - `portal=clientes` → `clientes`
  - `portal=agentes` → `agentes` (nuevo)
  - default / `inmobiliarias` → `inmobiliarias`
    y obtener el host vía el helper (con sufijo `-dev` automático fuera de prod).
- Otros archivos detectados con literales `*.sozu.com` (a revisar y migrar al helper donde apliquen): `src/App.tsx`, `src/pages/public/RegistroInmobiliaria.tsx`, `src/pages/public/Registro.tsx`, `src/pages/public/AgentesLanding.tsx`, `src/hooks/useDynamicMenus.ts`, `src/hooks/useClienteResumenFinanciero.ts`, varias páginas en `src/pages/admin/**`. Solo se sustituirán las que apunten a hosts del portal — no se tocarán correos como `notificaciones@sozu.com`.

### B) Edge Functions (entregables en `Ejecuciones_manuales/` para que tú las despliegues)

Como por convención del proyecto **no puedo modificar/desplegar edge functions**, generaré los archivos `.md` con el código Deno completo listo para reemplazar. Cambios requeridos:

1. **`supabase/functions/registro-publico/index.ts`**
   - Cambiar la constante `AGENTE_PORTAL_URL = 'https://inmobiliarias.sozu.com'` para que use un helper que resuelva por ambiente y portal `agentes`. El `confirmationUrl` que se construye (`${AGENTE_PORTAL_URL}/auth/confirmacion-email?...&portal=agentes&...`) quedará apuntando a `agentes.sozu.com` (o `agentes-dev.sozu.com` fuera de prod).
   - Nota: el query param `portal` actualmente envía `inmobiliarias`; cambiarlo a `agentes` para que `ConfirmacionEmail.tsx` redirija al host correcto.

2. **`supabase/functions/post-confirmacion-registro/index.ts`**
   - `getPortalConfig(rolId)` actualmente devuelve `inmobiliarias.sozu.com` para no-cliente. Reemplazar por lógica que use rol → portal (`agentes` para rol `Agente Inmobiliario`, `inmobiliarias` para rol 4, `clientes` para rol 23) y luego resuelva el host por ambiente. El `detalles` del template `41353048` mostrará `https://agentes.sozu.com/auth/login` (o `-dev` fuera de prod).

3. **`supabase/functions/notificar-confirmacion-email/index.ts`**
   - Misma corrección: `portalUrl` para `rolId === 3` debe ser `https://agentes.sozu.com/auth/login` (no `inmobiliarias.sozu.com`), respetando el ambiente.

4. **`supabase/functions/reenviar-confirmacion-email/index.ts`**
   - `host` actualmente: cliente → `clientes.sozu.com`, otros → `inmobiliarias.sozu.com`. Cambiar a: cliente → `clientes`, agente (rol 3) → `agentes`, inmobiliaria (rol 4) → `inmobiliarias`, todos resueltos por ambiente.

5. Revisión de otras edge functions con literales de host (`asignar-propiedad`, `enviar-aviso-bulk`, `enviar-oferta-email`, `notificar-agentes`, `registro-inmobiliaria-publica`, `seed-admin-user`, etc.): agregar el mismo helper para que respete `-dev` fuera de prod. No se tocan literales de email (`notificaciones@sozu.com`).

   Helper sugerido (Deno) inyectado en cada función:

   ```ts
   const IS_PROD = (Deno.env.get('ENVIRONMENT') ?? '').toLowerCase() === 'production';
   const portalHost = (p: 'admin'|'agentes'|'inmobiliarias'|'clientes') =>
     `https://${p}${IS_PROD ? '' : '-dev'}.sozu.com`;
   ```

   Requiere que el secret `ENVIRONMENT` exista en Supabase Edge Functions. Si no, se asume no-prod (sufijo `-dev`). Te indicaré en el `.md` que lo configures.

### C) Entregables manuales

Un solo archivo nuevo:

- `Ejecuciones_manuales/05_urls_por_portal_y_ambiente.md` con:
  - Bloque 1: secret `ENVIRONMENT=production` (solo en prod) para edge functions.
  - Bloque 2..N: código Deno completo de cada edge function modificada (las 4-5 listadas arriba), cada una en su propio bloque con encabezado y fecha.

## Lo que NO cambia

- Direcciones `From:` de correos (`notificaciones@sozu.com`).
- Lógica de negocio, templates de Postmark, autenticación, RLS.
- `.env*` (ya están correctos para dev).

## Resultado esperado

- Agente que se registra recibe link de confirmación a `https://agentes(-dev).sozu.com/auth/confirmacion-email?...`.
- Tras confirmar, recibe correo de credenciales con portal `https://agentes(-dev).sozu.com/auth/login`.
- En preview/dev, todos los enlaces a portales usan `*-dev.sozu.com`; en producción usan los dominios sin sufijo.
