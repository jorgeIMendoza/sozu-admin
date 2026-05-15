## Problema

El `DevelopmentBanner` ya se renderiza globalmente en `App.tsx` y aparece en el DOM en la landing de agentes, pero la barra de navegación de `AgentesLanding.tsx` está posicionada como `fixed top-0 left-0 right-0 z-50`, lo que la saca del flujo y la coloca encima del banner, ocultándolo visualmente.

## Cambio

### `src/pages/public/AgentesLanding.tsx`

Cambiar la `<nav>` de `fixed` a `sticky`:

- Antes: `className="fixed top-0 left-0 right-0 z-50 bg-white/95 ..."`
- Después: `className="sticky top-0 z-40 bg-white/95 ..."`

Con `sticky` la barra:
1. Permanece pegada al hacer scroll (mismo UX que tenía con `fixed`).
2. Sigue dentro del flujo normal del documento, por lo que el `DevelopmentBanner` (renderizado antes en el árbol) queda **arriba** y visible.

Como el navbar ya no estará "flotando" sobre contenido inicial, también se puede reducir el padding superior del hero (`pt-24 sm:pt-32`) que existía únicamente para compensar el navbar fijo. Lo dejaré en `pt-12 sm:pt-16` para mantener buen espaciado sin doble margen.

## Otras landings

`Registro.tsx` y `RegistroInmobiliaria.tsx` no tienen navbar `fixed`, así que el banner ya se ve correctamente ahí — no requieren cambios.

`AgentesLanding` es la única afectada.