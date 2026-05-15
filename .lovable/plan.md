## Objetivo

1. Mostrar el cintillo de ambiente (banner amarillo "AMBIENTE DE DESARROLLO") en los subdominios `*-dev.sozu.com` (agentes-dev, inmobiliarias-dev, clientes-dev, admin-dev), no solo cuando `VITE_ENVIRONMENT` lo indique.
2. Eliminar URLs hardcodeadas a `agentes.sozu.com` / `inmobiliarias.sozu.com` en las landings y páginas públicas, para que en desarrollo apunten a los hosts `-dev`.

## Cambios

### 1. `src/components/DevelopmentBanner.tsx`
Agregar detección por hostname: si `window.location.hostname` termina en `-dev.sozu.com`, mostrar el cintillo amarillo de "AMBIENTE DE DESARROLLO" aunque `ENVIRONMENT` no sea `development`/`preview`. Esto cubre el caso donde el build se publica con `VITE_ENVIRONMENT=production` pero se sirve en el subdominio dev.

### 2. `src/pages/public/AgentesLanding.tsx`
Reemplazar los 4 `href="https://agentes.sozu.com/..."` (Acceder, Registrarme, Acceder a mi cuenta, Convertirme en Agente, Registrarme como Agente) por URLs construidas con `getPortalHost('agentes')` de `@/lib/portalUrls`. Resultado: en preview/dev apuntarán a `agentes-dev.sozu.com`.

### 3. `src/pages/public/Registro.tsx`
Reemplazar los 2 `href="https://agentes.sozu.com/login"` por `${getPortalHost('agentes')}/login`. Los enlaces a `www.sozu.com` (términos, privacidad) se dejan intactos porque son sitios institucionales, no portales del producto.

### 4. `src/pages/public/RegistroInmobiliaria.tsx`
Reemplazar los 2 `href="https://inmobiliarias.sozu.com/login"` por `${getPortalHost('inmobiliarias')}/login`. Igual, `www.sozu.com` se respeta.

## Notas técnicas

- `getPortalHost(portal)` ya existe en `src/lib/portalUrls.ts` y devuelve `https://{portal}.sozu.com` en producción o `https://{portal}-dev.sozu.com` en cualquier otro ambiente, según `ENVIRONMENT`.
- El banner ya está montado globalmente en `App.tsx` dentro de `<BrowserRouter>`, por lo que el fix solo requiere ampliar la condición de visibilidad dentro del propio componente.
- No se tocan rutas, lógica de auth ni edge functions.