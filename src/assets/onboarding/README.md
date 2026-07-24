# Assets del onboarding "Registrar mi propiedad" (desarrollo Margot)

Coloca aquí los binarios reales que en el prototipo de Lovable vivían en su CDN.
Luego, en `src/lib/portal-cliente/onboarding-assets.ts`, cambia cada `undefined`
por el import correspondiente.

## Archivos esperados (usa exactamente estos nombres)

| Archivo                      | Uso en el flujo                                   | Estado    |
|------------------------------|---------------------------------------------------|-----------|
| `margot-fachada.jpeg`        | Render/foto del edificio (hero de la card + cover)| en repo   |
| `margot-kind-planta.png`     | Plano de la unidad (dialog ampliable, paso 1)     | pendiente |
| `margot-wordmark.png`        | Logotipo Margot (chip del desarrollo)             | pendiente |
| `margot-wordmark-light.png`  | Logotipo Margot en versión clara (sobre el hero)  | pendiente |
| `margot-isotipo.png`         | Isotipo Margot (ícono pequeño)                    | pendiente |

## Cómo cablearlos (después de dejarlos aquí)

En `src/lib/portal-cliente/onboarding-assets.ts`, por ejemplo:

```ts
import margotFachadaImg from "@/assets/onboarding/margot-fachada.jpeg";
export const margotFachada: string | undefined = margotFachadaImg;
```

La UI degrada con gracia cuando un asset vale `undefined` (ícono/texto/gradiente),
pero **el `import` solo puede escribirse si el archivo ya está en el repo**: Vite
resuelve estos imports en build time y uno apuntando a un archivo inexistente
rompe el build completo con `Could not load ... ENOENT`, no degrada. Por eso los
pendientes se quedan en `undefined` hasta que subas el binario.

> Nota: si alguno ya existe en el repo (p. ej. `src/assets/margot.jpg`), puedes
> importarlo directo sin duplicarlo.
