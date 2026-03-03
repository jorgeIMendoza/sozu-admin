

## Plan: Convertir "Carta de Acuerdos" en gestor multi-carta con opcion de validacion biometrica

### Contexto actual
- Existe una sola tabla `carta_acuerdos_template` con un unico registro (se hace `.limit(1).single()`)
- La vista actual muestra un editor, firmantes y firmas para esa unica carta
- La edge function `mifiel-crear-documento` genera el PDF y lo envia a Mifiel

### Arquitectura propuesta

**1. Nueva tabla en Supabase: `cartas_acuerdo`** (reemplaza el uso de `carta_acuerdos_template`)

```sql
CREATE TABLE public.cartas_acuerdo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  contenido_html TEXT NOT NULL DEFAULT '',
  firmantes_config JSONB DEFAULT '[]',
  requiere_validacion_biometrica BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);
```

- Se migra el registro existente de `carta_acuerdos_template` a esta nueva tabla
- El campo `requiere_validacion_biometrica` controla si se envia `allowed_signature_methods: ["FESCV"]` o no a Mifiel

**2. Reestructurar la vista `CartaAcuerdos.tsx`**

La pagina tendra dos estados:

- **Vista listado** (por defecto): Muestra todas las cartas como tarjetas/cards con nombre, descripcion, badge activo/inactivo, conteo de firmas y boton de editar. Incluye boton "Nueva Carta". En la parte superior, un disclaimer:
  > "Las cartas de acuerdo son documentos informativos que no requieren una robusta validez legal. Se utilizan para formalizar compromisos comerciales entre las partes."

- **Vista detalle/editor**: Al hacer clic en una carta, se abre la vista actual (con tabs: Editor, Firmantes, Firmas) pero contextualizada a esa carta especifica. Se agrega un boton "Volver" para regresar al listado.

**3. Dialogo "Nueva Carta"**

Un dialogo simple con:
- Nombre de la carta (obligatorio)
- Descripcion (opcional)
- Toggle: "Requiere validacion biometrica" (Switch con tooltip explicativo)

**4. Configuracion de validacion biometrica por carta**

- En la vista de detalle/editor, agregar un Switch en el header: "Validacion biometrica"
- Este campo se persiste en `cartas_acuerdo.requiere_validacion_biometrica`
- En la edge function `mifiel-crear-documento`, se recibe este flag y se agrega `allowed_signature_methods: ["FESCV"]` solo si esta activo

**5. Actualizar `firmas_digitales`**

- Agregar campo `carta_acuerdo_id` (UUID, FK) para vincular firmas con la carta especifica
- El query de firmas filtra por `carta_acuerdo_id` en lugar de solo `tipo_documento`

**6. Actualizar la edge function**

- Recibir `carta_acuerdo_id` en el body
- Leer el template y firmantes de la tabla `cartas_acuerdo` en lugar de `carta_acuerdos_template`
- Condicionar `allowed_signature_methods` segun el flag `requiere_validacion_biometrica`

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| **Migracion SQL** | Crear tabla `cartas_acuerdo`, migrar datos |
| `src/pages/admin/legal/CartaAcuerdos.tsx` | Reestructurar con vista listado + vista detalle |
| `src/components/admin/NuevaCartaAcuerdoDialog.tsx` | Nuevo dialogo para crear cartas |
| `supabase/functions/mifiel-crear-documento/index.ts` | Leer de nueva tabla, condicionar biometria |
| `src/components/admin/AgentOnboardingStepDialog.tsx` | Actualizar referencia a nueva tabla |

### Flujo del usuario

```text
Cartas de Acuerdo (listado)
  ├── [Disclaimer: no requiere robusta validez legal]
  ├── [+ Nueva Carta] → Dialogo con nombre, descripcion, toggle biometria
  ├── Card 1: "Carta Agente Inmobiliario" [Activa] [Biometria: No] [4 firmas] → [Editar]
  ├── Card 2: "Carta Colaborador Externo" [Activa] [Biometria: Si] [0 firmas] → [Editar]
  └── ...

Vista detalle (misma que actual):
  [← Volver]  "Carta Agente Inmobiliario"  [Validacion biometrica: toggle]
  [Editor] [Firmantes] [Firmas (4)]
```

