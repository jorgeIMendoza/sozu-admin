
# Plan: Sistema de Versionado Automático por Build

## Problema
La versión actual es estática (`v2.4.0`) y requiere actualización manual antes de cada deploy a producción, lo cual es fácil de olvidar.

## Solución Recomendada

Implementar un sistema de versionado automático basado en **fecha y hora del build**. Cada vez que se publique a producción, Vite generará un identificador único de versión en tiempo de compilación.

### Formato de Versión Propuesto
```
v2.4.0-250203.1542
```
Donde:
- `v2.4.0` = Versión semántica (se actualiza manualmente para cambios mayores)
- `250203` = Fecha del build (YYMMDD)
- `1542` = Hora del build (HHMM)

Esto permite:
1. **Saber la versión base** (2.4.0)
2. **Identificar exactamente cuándo se publicó** (3 Feb 2025 a las 15:42)
3. **Comparar versiones fácilmente** (250203.1542 es posterior a 250202.0900)

## Cambios Técnicos

| Archivo | Cambio |
|---------|--------|
| `vite.config.ts` | Agregar `define` para inyectar `__APP_VERSION__` y `__BUILD_TIMESTAMP__` en tiempo de build |
| `src/vite-env.d.ts` | Declarar tipos TypeScript para las variables globales |
| `src/lib/config.ts` | Agregar constante `APP_VERSION` que combina versión + timestamp |
| `src/components/admin/AdminSidebar.tsx` | Usar `APP_VERSION` de config en lugar de string hardcodeado |
| `package.json` | Actualizar `version` a `2.4.0` para usar como versión base |

### Implementación en vite.config.ts
```typescript
export default defineConfig(({ mode }) => {
  const buildTimestamp = new Date().toISOString();
  const buildDate = buildTimestamp.slice(2, 10).replace(/-/g, ''); // YYMMDD
  const buildTime = buildTimestamp.slice(11, 16).replace(':', ''); // HHMM
  
  return {
    define: {
      __APP_VERSION__: JSON.stringify('2.4.0'),
      __BUILD_TIMESTAMP__: JSON.stringify(`${buildDate}.${buildTime}`),
    },
    // ... resto de config
  };
});
```

### Uso en AdminSidebar.tsx
```typescript
import { APP_VERSION } from "@/lib/config";

// En el JSX:
<p className="text-[10px] text-muted-foreground/60">{APP_VERSION}</p>
```

## Flujo de Trabajo

1. **Cambios menores** (bug fixes, mejoras pequeñas): 
   - No hacer nada, la fecha/hora cambiará automáticamente

2. **Cambios mayores** (nuevas funcionalidades importantes):
   - Actualizar `version` en `package.json` (ej: `2.4.0` → `2.5.0`)
   - El build tomará la nueva versión automáticamente

## Resultado Esperado

| Antes | Después |
|-------|---------|
| `v2.4.0` (estático, sin saber cuándo se publicó) | `v2.4.0-250203.1542` (versión + fecha/hora exacta del build) |

Cada deploy a producción tendrá una versión única sin intervención manual.
