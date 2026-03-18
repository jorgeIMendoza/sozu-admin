

## Plan: Reestructurar onboarding del Portal de Agente

### Reglas de negocio (resumidas)

| Nivel | Requisito | Qué desbloquea |
|-------|-----------|-----------------|
| 0 | Ninguno | Ver inventario |
| 1 | Capacitación completada | Generar oferta **sin** sección STP |
| 2 | Capacitación + Info básica completa (identidad) | Generar oferta **con** sección STP |
| 3 | Identidad + Fiscal + Cuenta bancaria | Ver comisiones |
| Firma | Info básica + documentos obligatorios completos | Habilitar firma carta cumplimiento |

### Cambios por archivo

#### 1. `src/hooks/useAgentOnboardingStatus.ts`
Agregar campos derivados al return del hook:
- `hasTrainingComplete`: boolean — capacitación completada (ya existe internamente como `trainingComplete`)
- `hasBasicIdentityComplete`: boolean — step `basic` (Identidad) completo
- `canAccessComisiones`: boolean — Identidad + Fiscal + Cuenta bancaria completos
- `missingForComisiones`: string[] — lista de pasos faltantes para comisiones

#### 2. `src/pages/admin/agent-portal/AgentUnidadesProyecto.tsx`
- Importar los nuevos campos del hook (`hasTrainingComplete`, `hasBasicIdentityComplete`)
- Donde actualmente muestra el botón `NewOfferDialog` (línea ~663):
  - Si `!hasTrainingComplete` → botón deshabilitado con texto "Completa tu capacitación para generar ofertas"
  - Si `hasTrainingComplete` pero `!hasBasicIdentityComplete` → pasar `hideBankingInPdf={true}` (sin STP)
  - Si ambos completos → pasar `hideBankingInPdf={false}` (con STP)
- Eliminar la lógica actual `hideBankingInPdf={isAgentRole && !isVerified}` y reemplazarla con la nueva

#### 3. `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx`
- Importar hook y verificar `hasTrainingComplete`
- Si `!hasTrainingComplete` y es `Agente Inmobiliario` → deshabilitar botón "Generar oferta comercial" con mensaje explicativo

#### 4. `src/pages/admin/agent-portal/AgentPipeline.tsx`
- Importar hook y verificar `hasTrainingComplete`
- Si `!hasTrainingComplete` y es `Agente Inmobiliario` → deshabilitar botón "Nueva oferta" con tooltip/mensaje

#### 5. `src/pages/admin/agent-portal/AgentComisiones.tsx`
- Cambiar la condición de bloqueo actual (`fiscalComplete && bankComplete && docsComplete`) por `canAccessComisiones` del hook (Identidad + Fiscal + Banco)
- Actualizar los CheckItems para reflejar los 3 requisitos correctos: Identidad, Información fiscal, Cuenta bancaria

#### 6. `src/components/admin/AgentOnboardingStepDialog.tsx`
- En el step de `training` (donde está la firma), verificar que el step `basic` (Identidad) esté completo incluyendo documentos
- Si no está completo, deshabilitar la firma y mostrar mensaje: "Completa tu información básica y documentos obligatorios para firmar"

#### 7. `src/pages/admin/agent-portal/AgentInicio.tsx`
- Ajustar el banner de progreso para reflejar mensajes según el nivel actual del agente

### Nota
- Solo el rol `Agente Inmobiliario` recibe estas restricciones; otros roles (Super Admin, etc.) no se ven afectados
- El inventario permanece sin cambios (acceso libre)

