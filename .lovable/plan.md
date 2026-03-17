

## Plan: Prevenir creación de documentos Mifiel en entorno incorrecto

### Diagnóstico
El registro `id=26` tiene `environment: "development"` en su metadata. Esto indica que la edge function recibió `"development"` desde el frontend. La causa más probable es que el usuario (o un admin) inició el flujo de firma desde el **Preview de Lovable** en lugar del sitio publicado de producción.

### Cambios propuestos

**1. Corrección de datos — Cancelar el registro erróneo**
Ejecutar UPDATE en `firmas_digitales` para marcar el registro 26 como `cancelado`, permitiendo que el usuario re-inicie el flujo desde producción.

```sql
UPDATE firmas_digitales SET estado = 'cancelado' WHERE id = 26;
```

**2. Guardia de entorno en el frontend** (`AgentOnboardingStepDialog.tsx`)
En la función `handleContinuarFirmaInternal`, después de obtener `firmaExistente`, validar que `metadata.environment` coincida con `ENVIRONMENT` actual. Si no coincide:
- Mostrar toast explicativo
- Cancelar automáticamente el registro viejo
- Refrescar para permitir re-creación

**3. Corregir fallback en `config.ts`**
Cambiar `'produccion'` → `'production'` en la línea 11 para que sea consistente con lo que la edge function espera. Esto previene problemas si la variable no se inyecta:
```typescript
export const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'production';
```

### Archivos a modificar
- `src/lib/config.ts` — corregir fallback
- `src/components/admin/AgentOnboardingStepDialog.tsx` — agregar guardia de entorno

### Resultado
- Ivan podrá firmar correctamente desde producción tras re-iniciar el flujo
- Se previenen futuros errores de entorno cruzado

