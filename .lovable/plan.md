
# Auto-captura, verificacion IA, selfie, comparador y guardado de datos

## Resumen

Se implementara el flujo completo de verificacion de identidad con la capacidad adicional de **guardar los datos extraidos del documento directamente en los campos correspondientes del perfil**. El comparador no solo mostrara coincidencias y discrepancias, sino que permitira al usuario seleccionar que datos del documento desea guardar en su perfil.

---

## Flujo completo

1. Agente selecciona INE o Pasaporte
2. Camara trasera con auto-captura por estabilidad (1.5s quieto)
3. Captura INE frente, luego reverso automaticamente (o pasaporte)
4. Camara frontal con guia ovalada para selfie
5. Se envia todo a Gemini Vision para verificacion
6. **Panel comparador con opcion de guardar** cada dato extraido en el perfil
7. Al aceptar, se guardan los datos seleccionados

---

## 1. Auto-captura por estabilidad

Cambios en `AgentOnboardingStepDialog.tsx`:

- Loop con `requestAnimationFrame` que compara frames via canvas oculto (muestreo cada 10px)
- Si diferencia < 2% durante 1.5 segundos: auto-captura
- Anillo SVG de progreso alrededor del boton de captura
- Flash blanco breve al capturar
- Boton manual como respaldo
- Aplica a documentos (camara trasera) y selfie (camara frontal)

---

## 2. Selfie con guia ovalada

- Nuevo `cameraStep: 'selfie'` con `facingMode: 'user'`
- Guia ovalada CSS con borde punteado y overlay oscuro fuera del ovalo
- Texto: "Centra tu rostro en el ovalo"
- Boton circular grande
- Auto-captura por estabilidad tambien activa
- Se guarda como documento tipo 49 ("Selfie de verificacion"), no visible en UI

---

## 3. Edge Function: `verificar-documento-identidad`

Nuevo archivo: `supabase/functions/verificar-documento-identidad/index.ts`

Usa Gemini Vision via Lovable AI Gateway con tool calling. Recibe:

```text
{ imageUrl, expectedType, selfieUrl? }
```

Retorna datos estructurados:

```text
{
  is_valid_document: boolean,
  document_type: "ine_frente" | "ine_reverso" | "pasaporte" | "otro",
  confidence: number (0-100),
  full_name: string | null,
  curp: string | null,
  clave_elector: string | null,
  fecha_nacimiento: string | null,
  sexo: "H" | "M" | null,
  domicilio: string | null,
  vigencia: string | null,
  numero_identificacion: string | null,
  is_expired: boolean | null,
  authenticity_signals: string[],
  rejection_reason: string | null,
  face_match: boolean | null,
  face_match_confidence: number | null,
  face_match_reason: string | null
}
```

Config en `supabase/config.toml`:
```text
[functions.verificar-documento-identidad]
verify_jwt = false
```

---

## 4. Comparador de datos CON guardado

Este es el cambio clave. Despues de la verificacion, se muestra un panel interactivo:

```text
+--------------------------------------------------+
|  Verificacion de documento                        |
|                                                   |
|  Dato         Documento       Perfil     Guardar  |
|  ------       ---------       ------     -------  |
|  Nombre       MENDOZA C...    Jorge M.   [x]      |
|  CURP         MECJ850202...   (vacio)    [x]      |
|  F. Nac.      02/02/1985      (vacio)    [x]      |
|  Sexo         H               Hombre     [ ]      |
|  Clave Elec.  MNCRJR85...     -          n/a      |
|  Vigencia     2020-2030       -          n/a      |
|  Num. ID      2098573390      (vacio)    [x]      |
|                                                   |
|  Senales de autenticidad:                         |
|  [check] Formato oficial INE                      |
|  [check] Codigo de barras presente                |
|  Confianza: 92%                                   |
|                                                   |
|  Coincidencia facial: Si (87%)                    |
|                                                   |
|  [Guardar y aceptar]     [Rechazar]               |
+--------------------------------------------------+
```

### Logica de cada campo

| Dato del documento | Campo destino en `personas` | Campo destino en `documentos` | Logica |
|---|---|---|---|
| Nombre completo | `nombre_legal` | - | Checkbox pre-marcado si perfil esta vacio o difiere |
| CURP | `curp` | - | Checkbox pre-marcado si perfil esta vacio |
| Fecha nacimiento | `fecha_nacimiento` | - | Checkbox pre-marcado si perfil esta vacio |
| Sexo | `sexo` | - | Checkbox pre-marcado si perfil esta vacio |
| Numero identificacion (CIC/pasaporte) | - | `numero` | Siempre se guarda automaticamente |
| Clave elector | - | - | Solo se muestra, no se guarda |
| Vigencia | - | - | Solo se muestra y se valida no vencido |

### Comportamiento de los checkboxes

- **Pre-marcados** cuando el campo del perfil esta vacio (el dato del documento llena un hueco)
- **Pre-marcados** cuando el dato difiere y se considera que el documento es mas confiable
- **Desmarcados** cuando el dato ya coincide (no necesita actualizacion)
- El usuario puede marcar/desmarcar libremente antes de confirmar
- Campos que no existen en el perfil (clave elector, vigencia) solo se muestran informativamente

### Al presionar "Guardar y aceptar"

1. Se actualiza `personas` con los campos marcados:
   - `nombre_legal`, `curp`, `fecha_nacimiento`, `sexo` segun seleccion
2. Se actualiza `documentos.numero` con el numero de identificacion extraido (CIC o pasaporte)
3. Se actualiza `documentos.id_estatus_verificacion` a 2 (validado)
4. Se invalidan queries de onboarding para refrescar el progreso
5. Toast de exito: "Documento verificado y datos actualizados"

### Al presionar "Rechazar"

1. Se marca `documentos.activo = false`
2. Se reinicia la camara para nuevo intento
3. No se modifica ningun dato del perfil

---

## 5. Migracion SQL

```sql
INSERT INTO tipos_documento (id, nombre, activo)
VALUES (49, 'Selfie de verificación', true)
ON CONFLICT (id) DO NOTHING;
```

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/verificar-documento-identidad/index.ts` | Crear - edge function con Gemini Vision |
| `supabase/config.toml` | Modificar - agregar config nueva funcion |
| `src/components/admin/AgentOnboardingStepDialog.tsx` | Modificar - auto-captura, selfie, comparador con guardado |
| Migracion SQL | Crear tipo documento 49 |

---

## Resumen de campos guardables

Para ser explicito sobre que se puede guardar y donde:

**En tabla `personas`** (perfil del agente):
- `nombre_legal` - desde el nombre impreso en el INE/Pasaporte
- `curp` - desde el CURP impreso en el INE frente
- `fecha_nacimiento` - desde la fecha en el INE o extraida del MRZ
- `sexo` - "H" o "M" desde el INE

**En tabla `documentos`** (registro del documento):
- `numero` - CIC del INE (extraido del MRZ del reverso, ej: `2098573390`) o numero de pasaporte
- `id_estatus_verificacion` - se actualiza a 2 (validado) si la IA confirma
