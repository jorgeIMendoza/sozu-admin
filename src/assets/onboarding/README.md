# Assets del onboarding "Registrar mi propiedad" (desarrollo Margot)

Coloca aquí los binarios reales que en el prototipo de Lovable vivían en su CDN.
Luego, en `src/lib/portal-cliente/onboarding-assets.ts`, cambia cada `undefined`
por el import correspondiente.

## Archivos esperados (usa exactamente estos nombres)

| Archivo                      | Uso en el flujo                                   |
|------------------------------|---------------------------------------------------|
| `margot-fachada.jpeg`        | Render/foto del edificio (hero de la card + cover)|
| `margot-kind-planta.png`     | Plano de la unidad (dialog ampliable, paso 1)     |
| `margot-wordmark.png`        | Logotipo Margot (chip del desarrollo)             |
| `margot-wordmark-light.png`  | Logotipo Margot en versión clara (sobre el hero)  |
| `margot-isotipo.png`         | Isotipo Margot (ícono pequeño)                    |

## Cómo cablearlos (después de dejarlos aquí)

En `src/lib/portal-cliente/onboarding-assets.ts`, por ejemplo:

```ts
import margotFachadaImg from "@/assets/onboarding/margot-fachada.jpeg";
export const margotFachada: string | undefined = margotFachadaImg;
```

Si falta alguno, no pasa nada: el flujo degrada con ícono/texto/gradiente.

> Nota: si alguno ya existe en el repo (p. ej. `src/assets/margot.jpg`), puedes
> importarlo directo sin duplicarlo.
