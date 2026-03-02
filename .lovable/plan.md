

# Centralizar URL de Mifiel en variable de entorno

## Problema

La URL `https://app-sandbox.mifiel.com/api/v1` esta hardcodeada en 3 edge functions:
- `mifiel-crear-documento`
- `mifiel-consultar-documento`
- `mifiel-webhook`

Cuando se pase a produccion, habria que editar las 3 funciones manualmente.

## Solucion

Crear un secret `MIFIEL_API_URL` en Supabase con el valor actual (`https://app-sandbox.mifiel.com/api/v1`) y reemplazar la constante hardcodeada en las 3 funciones por `Deno.env.get("MIFIEL_API_URL")`.

Tambien aplica para el widget CDN en el frontend (`MifielSigningDialog.tsx`), que usa `https://app-sandbox.mifiel.com/sign-widget-assets/v3/index.js`. Para el frontend se usara una variable `VITE_MIFIEL_ENVIRONMENT` (valor: `sandbox` o `production`) que determine la URL del widget.

## Cambios

### 1. Agregar secret MIFIEL_API_URL en Supabase

Valor: `https://app-sandbox.mifiel.com/api/v1`

### 2. Actualizar edge functions (3 archivos)

En cada una, reemplazar:
```typescript
const MIFIEL_API_URL = "https://app-sandbox.mifiel.com/api/v1";
```
Por:
```typescript
const MIFIEL_API_URL = Deno.env.get("MIFIEL_API_URL") || "https://app-sandbox.mifiel.com/api/v1";
```

Archivos:
- `supabase/functions/mifiel-crear-documento/index.ts`
- `supabase/functions/mifiel-consultar-documento/index.ts`
- `supabase/functions/mifiel-webhook/index.ts` (la URL inline en el fetch del PDF tambien usara la variable)

### 3. Actualizar frontend widget URL

**Archivo:** `src/components/admin/MifielSigningDialog.tsx`

Agregar variable de entorno `VITE_MIFIEL_ENVIRONMENT` a los archivos `.env`:
- Valor: `sandbox` (desarrollo) o `production` (produccion)

En el componente, construir la URL del widget dinamicamente:
```typescript
const mifielEnv = import.meta.env.VITE_MIFIEL_ENVIRONMENT || 'sandbox';
const mifielHost = mifielEnv === 'production' ? 'app.mifiel.com' : 'app-sandbox.mifiel.com';
const widgetUrl = `https://${mifielHost}/sign-widget-assets/v3/index.js`;
```

### 4. Actualizar archivos .env

Agregar `VITE_MIFIEL_ENVIRONMENT=sandbox` a:
- `.env`
- `.env.development`
- `.env.production` (cambiar a `production` cuando sea el momento)
- `.env.example`

## Beneficio

Para cambiar de sandbox a produccion solo se necesita:
1. Cambiar el secret `MIFIEL_API_URL` en Supabase Dashboard
2. Cambiar `VITE_MIFIEL_ENVIRONMENT` a `production` en `.env.production`

Sin tocar codigo.
