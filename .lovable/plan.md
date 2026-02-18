

# Plan: Onboarding Gamificado para Agentes

## Objetivo

Agregar un widget de progreso gamificado en la vista de proyectos del agente (`MisProyectos.tsx`) que muestre 5 pasos de onboarding con indicadores visuales de completitud y acceso rapido para editar cada seccion.

## Diseno Visual (Mobile-First)

El widget se mostrara entre el header y el boton "Explorar inventario" como una tarjeta compacta con:

1. **Barra de progreso circular o lineal** con porcentaje (ej. "60% completado")
2. **5 pasos** mostrados como iconos circulares conectados (stepper horizontal en desktop, vertical compacto en mobile)
3. Cada paso completado se pinta en verde con check animado
4. Cada paso incompleto se pinta en gris con icono del paso
5. **Boton "Completar"** en cada paso incompleto que abre un Drawer (mobile) o Dialog (desktop) con el formulario correspondiente
6. Cuando todos esten completos, el widget se colapsa a un badge "Perfil completo" con confetti visual

## Pasos del Onboarding

| Paso | Campos validados | Fuente |
|------|-----------------|--------|
| Informacion Basica | nombre_legal, email, telefono | personas |
| Direccion | calle, num_ext, colonia, cp, pais, estado, municipio | personas |
| Informacion Fiscal | rfc, regimen, uso_cfdi, direccion fiscal completa | personas |
| Documentos | INE frente (2), INE reverso (3), Constancia (6), Contrato comercializacion (48) | documentos |
| Cuentas Bancarias | minimo 1 cuenta bancaria activa | cuentas_bancarias |

## Seccion Tecnica

### Archivos nuevos

**`src/hooks/useAgentOnboardingStatus.ts`**
- Hook que recibe `personaId` y consulta:
  - Datos de `personas` (campos basicos, direccion, fiscal)
  - Documentos del agente (tipos 2, 3, 6, 48)
  - Cuentas bancarias activas
- Retorna un objeto con `steps: { id, label, icon, isComplete }[]`, `completedCount`, `totalSteps`, `percentage`
- Query key: `['agent-onboarding-status', personaId]`

**`src/components/admin/AgentOnboardingWidget.tsx`**
- Componente del widget gamificado
- Usa `useAgentOnboardingStatus(profile.id_persona)`
- Renderiza stepper visual con iconos (User, MapPin, FileText, FolderOpen, Landmark)
- Cada paso tiene boton "Completar" que abre el drawer/dialog de edicion
- Animaciones: check bounce en pasos completos, pulse en el siguiente paso pendiente
- Responsive: en mobile los pasos se apilan verticalmente como lista compacta

**`src/components/admin/AgentOnboardingStepDialog.tsx`**
- Dialog/Drawer responsivo (Drawer en mobile, Dialog en desktop)
- Recibe `step` (basic/address/fiscal/documents/bank-accounts) y `personaId`
- Carga los datos completos de la persona (patron full-fetch)
- Renderiza formularios especificos por paso (NO reutiliza PersonForm completo, sino secciones individuales extraidas):
  - **Basico**: nombre, email, telefono, tipo persona
  - **Direccion**: campos de direccion fisica
  - **Fiscal**: RFC, regimen, uso CFDI, direccion fiscal (con opcion copiar)
  - **Documentos**: componente DocumentsTab filtrado a tipos 2, 3, 6, 48
  - **Cuentas bancarias**: componente BankAccountsSection
- Boton "Guardar" que actualiza solo los campos del paso y refresca el status
- Estilo mobile-first con inputs grandes, spacing generoso, scroll suave

### Archivos modificados

**`src/pages/admin/inmobiliarias/MisProyectos.tsx`**
- Importar y renderizar `AgentOnboardingWidget` entre el header y el boton "Explorar inventario"
- Solo se muestra para `profile.rol_nombre === "Agente Inmobiliario"` y cuando el perfil no esta 100% completo
- Se oculta automaticamente cuando el agente completa todo

### Flujo de datos

```text
MisProyectos
  -> AgentOnboardingWidget
    -> useAgentOnboardingStatus(profile.id_persona)
      -> 3 queries paralelas: persona, documentos, cuentas_bancarias
    -> onClick paso -> AgentOnboardingStepDialog
      -> full-fetch persona data
      -> formulario del paso
      -> guardar -> invalidar 'agent-onboarding-status'
      -> widget se actualiza automaticamente
```

### Estilo y UX

- Tarjeta con gradiente sutil (`bg-gradient-to-br from-card to-primary/5`)
- Barra de progreso animada con color que transiciona de rojo (0%) a amarillo (50%) a verde (100%)
- Iconos circulares: completados = fondo verde + check blanco, pendientes = fondo gris + icono
- El siguiente paso pendiente tiene un efecto `ring-2 ring-primary animate-pulse` para guiar al usuario
- En mobile: lista vertical con filas de `icono | nombre | badge status | boton`
- En desktop: stepper horizontal con lineas conectoras entre iconos
- Al completar todo: animacion de "felicitacion" con badge dorado "Perfil Completo"

