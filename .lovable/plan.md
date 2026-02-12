
## Plan: Mejorar validación de destinatarios y logging de cron

### 1. **Validación en Frontend - Evitar guardar sin destinatarios**
**Archivo:** `src/pages/admin/comunicacion/AdministrarAvisos.tsx`

**Cambio en `handleSave()` (línea 262)**
- Agregar validación que verifique si hay destinatarios configurados
- Si `selectedRoles.length === 0 AND destinatarios.length === 0`, mostrar error
- Bloquear el guardado con un toast descriptivo

**Antes:** Se guardaba aunque no hubiera destinatarios

**Después:** 
```typescript
const handleSave = async () => {
  // Validaciones existentes...
  if (!nombre || !asunto || !mensajeHtml) { ... }
  if (tipoEnvio === 'automatico') { ... }
  
  // NUEVA VALIDACION
  if (selectedRoles.length === 0 && destinatarios.length === 0) {
    toast({ 
      title: "Error", 
      description: "Debes agregar al menos un rol o un destinatario manualmente", 
      variant: "destructive" 
    });
    return;
  }
  
  // Resto del código...
}
```

### 2. **Logging Detallado en Edge Function - Cron**
**Archivo:** `supabase/functions/ejecutar-avisos-cron/index.ts`

**Cambios:**
- Agregar log al inicio con hora actual en Mexico (UTC-6)
- Agregar log de cuántos avisos automáticos se evaluaron
- Agregar logs detallados para cada aviso que NO coincide (mostrando su cron y por qué no coincide)
- Agregar logs cuando se dispara un aviso (con timestamp y aviso_id)
- Agregar logs de errores cuando falla el envío

**Beneficio:** 
- Usuario podrá ver en los Edge Function Logs de Supabase exactamente qué pasó
- Podrá identificar si un aviso tiene un cron mal configurado
- Podrá ver si se disparó correctamente o no

**Ejemplo de logs esperados:**
```
[10:13:42 Mexico UTC-6] Ejecutando cron de avisos...
[10:13:42] Total avisos automáticos activos: 2
[10:13:42] Evaluando aviso 1: cron="0 14 * * 1-5" (no coincide: hora actual 10, esperaba 14)
[10:13:42] Evaluando aviso 2: cron="0 10 * * 4" (COINCIDE - disparando)
[10:13:42] Aviso 2 disparado correctamente
```

### Impacto
- **Frontend:** Se previene que se guarden avisos sin destinatarios
- **Backend:** Logs detallados permiten debugging inmediato del sistema de cron
- **Usuario:** Feedback claro sobre por qué un aviso no se ejecutó
