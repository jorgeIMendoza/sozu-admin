
# Plan: Ocultar el boton nativo de instalacion PWA del navegador

## Problema
El navegador Chrome muestra un icono de instalacion PWA en la barra de direcciones porque detecta un `manifest.json` valido con todos los requisitos (nombre, iconos, display: standalone, start_url).

## Solucion
Cambiar la propiedad `display` del manifest de `standalone` a `browser`. Esto le indica a Chrome que la app no quiere ser instalada como PWA independiente, y el navegador deja de mostrar el boton de instalacion.

El Service Worker y todo el caching (offline, assets, Supabase) seguiran funcionando normalmente.

## Cambio requerido

**Archivo**: `vite.config.ts`

- Linea 108: Cambiar `display: 'standalone'` a `display: 'browser'`

Adicionalmente, capturar el evento `beforeinstallprompt` para prevenirlo como respaldo:

**Archivo**: `src/components/PWAInstallPrompt.tsx`

- Ya captura `beforeinstallprompt` y llama `e.preventDefault()`, lo cual esta correcto
- No requiere cambios adicionales

## Impacto
- El icono de instalacion PWA desaparece de la barra del navegador
- El caching y Service Worker siguen funcionando
- Si en el futuro quieres reactivarlo, solo cambias `browser` de vuelta a `standalone`

## Detalle tecnico
Un solo cambio en `vite.config.ts`, linea 108: `display: 'standalone'` -> `display: 'browser'`
