
# Plan: Sistema de Draft para Inmobiliarias con Registro Publico

## Resumen Ejecutivo
Este plan implementa un sistema de "Draft" para inmobiliarias que permite el registro publico sin autenticacion. Las inmobiliarias registradas por este medio quedaran en estado de borrador hasta que un administrador las apruebe.

---

## Parte 1: Cambios en la Base de Datos

### 1.1 Nueva columna en la tabla `personas`
Se agregara una nueva columna `es_draft` a la tabla `personas`:

```sql
ALTER TABLE personas ADD COLUMN es_draft BOOLEAN DEFAULT FALSE;
```

- **Tipo**: BOOLEAN
- **Default**: FALSE (las inmobiliarias existentes y las creadas internamente NO son draft)
- **Proposito**: Identificar registros que fueron creados por el formulario publico y requieren revision

---

## Parte 2: Modificaciones a la Vista de Inmobiliarias

### 2.1 Nueva pestana "Draft"
Se modificara `src/pages/admin/Inmobiliarias.tsx` para agregar una tercera pestana:

- **Activos**: `activo = true` AND `es_draft = false`
- **Draft**: `activo = true` AND `es_draft = true`
- **Eliminados**: `activo = false` (sin importar es_draft)

### 2.2 Logica de filtrado
La funcion `fetchInmobiliarias` recibira un nuevo parametro para distinguir entre los tres estados:

```typescript
// Tipos de pestana
type TabType = 'active' | 'draft' | 'deleted';

// Consultas por estado
- active: `.eq('activo', true)` en personas, filtrar post-fetch con `es_draft = false`
- draft: `.eq('activo', true).eq('es_draft', true)` en personas
- deleted: `.eq('activo', false)` en personas
```

### 2.3 Acciones disponibles en pestana Draft
- Ver detalles de la inmobiliaria
- **Aprobar**: Cambia `es_draft = false` (pasa a Activos)
- **Eliminar**: Cambia `activo = false` (pasa a Eliminados)

---

## Parte 3: Pagina de Registro Publico

### 3.1 Nueva ruta publica
Se creara una nueva pagina en `src/pages/public/RegistroInmobiliaria.tsx`:

- **URL**: `/registro-inmobiliaria`
- **Acceso**: Publico (sin autenticacion)
- **Diseno**: Similar al Login, con branding de Sozu

### 3.2 Formulario simplificado para Inmobiliaria
Campos obligatorios (4 campos marcados en la imagen):
1. **Razon Social** - Campo de texto
2. **Email** - Campo de email con validacion
3. **Telefono** - Campo con selector de pais (MX/US/CA) + 10 digitos
4. **Representante Legal** - Boton para crear uno nuevo (no selector)

Campos que NO aparecen en el formulario publico:
- Tipo de Persona (hardcodeado a "pm")
- Nombre Comercial
- Logo
- RFC
- Tipo de Entidad Legal (hardcodeado a 5 = Inmobiliaria)
- Representante Comercial
- Uso CFDI
- Regimen

### 3.3 Creacion de Representante Legal simplificado
Al hacer clic en el boton "Crear Representante Legal", se abrira un dialogo con solo:
1. **Nombre Completo** - Campo de texto obligatorio
2. **Email** - Campo de email obligatorio
3. **Telefono** - Campo con selector de pais + 10 digitos obligatorio
4. **RFC** - Campo de texto opcional (marcado en la imagen pero opcional para el flujo publico)

### 3.4 Componente dedicado
Se creara un nuevo componente `PublicRepresentanteLegalForm.tsx` que:
- Muestra solo los 4 campos requeridos
- No tiene pestanas adicionales (Direccion, Fiscal, Documentos, Cuentas Bancarias)
- Crea la persona y entidad_relacionada directamente

---

## Parte 4: Logica de Backend

### 4.1 Edge Function para registro publico
Se creara `supabase/functions/registro-inmobiliaria-publica/index.ts`:

- **Metodo**: POST
- **Auth**: Sin verificacion JWT (publico)
- **Validaciones**:
  - Email unico (no existe en usuarios ni en otras inmobiliarias)
  - Telefono de 10 digitos
  - Razon social no vacia
  - Email del representante legal unico

- **Proceso**:
  1. Crear persona para el Representante Legal (tipo_persona = 'pf')
  2. Crear entidad_relacionada para el Rep. Legal (id_tipo_entidad = 1)
  3. Crear persona para la Inmobiliaria (tipo_persona = 'pm', **es_draft = true**)
  4. Crear entidad_relacionada para la Inmobiliaria (id_tipo_entidad = 5)
  5. Vincular el rep. legal con la inmobiliaria (id_entidad_relacionada_rep_leg)
  
- **NO se crea usuario** automaticamente (solo cuando se aprueba el draft)

### 4.2 Proceso de aprobacion
Cuando un admin aprueba un draft desde la vista de Inmobiliarias:
1. Actualizar `es_draft = false` en la persona de la inmobiliaria
2. Llamar a `create-user` para crear el usuario con rol Inmobiliaria (rol_id = 4)
3. Enviar notificacion (N8N webhook existente)

---

## Parte 5: Archivos a Crear/Modificar

### Archivos nuevos:
```text
src/pages/public/RegistroInmobiliaria.tsx          - Pagina de registro publico
src/components/public/PublicRepresentanteLegalForm.tsx - Form simplificado para rep. legal
supabase/functions/registro-inmobiliaria-publica/index.ts - Edge function para registro
```

### Archivos a modificar:
```text
src/App.tsx                                        - Agregar ruta /registro-inmobiliaria
src/pages/admin/Inmobiliarias.tsx                  - Agregar pestana Draft y logica de filtrado
src/integrations/supabase/types.ts                 - Actualizar tipos para incluir es_draft
supabase/config.toml                               - Agregar configuracion de la nueva edge function
```

### Migracion de base de datos:
```text
supabase/migrations/[timestamp]_add_es_draft_to_personas.sql
```

---

## Parte 6: Flujo de Usuario

### 6.1 Flujo de registro publico
```text
1. Usuario visita /registro-inmobiliaria
2. Ve formulario simple con logo de Sozu
3. Completa: Razon Social, Email, Telefono
4. Hace clic en "Crear Representante Legal"
5. Dialogo se abre con 4 campos simples
6. Completa datos del rep. legal y guarda
7. Hace clic en "Registrar Inmobiliaria"
8. Ve mensaje de exito: "Tu registro ha sido recibido y esta pendiente de aprobacion"
```

### 6.2 Flujo de aprobacion (admin)
```text
1. Admin ve pestana "Draft" con N inmobiliarias pendientes
2. Revisa los datos de una inmobiliaria
3. Hace clic en "Aprobar"
4. Sistema cambia es_draft = false
5. Sistema crea usuario automaticamente
6. Inmobiliaria aparece en "Activos"
```

---

## Parte 7: Consideraciones de Seguridad

1. **Rate limiting**: Implementar en la Edge Function para evitar spam
2. **Validacion de email**: Formato correcto y dominio valido
3. **Sanitizacion de inputs**: Prevenir inyecciones
4. **Captcha opcional**: Considerar agregar reCAPTCHA en el futuro
5. **Logs de actividad**: Registrar todos los registros publicos

---

## Parte 8: Secuencia de Implementacion

1. Crear migracion de base de datos (`es_draft`)
2. Actualizar tipos de TypeScript
3. Modificar vista de Inmobiliarias (agregar pestana Draft)
4. Crear Edge Function para registro publico
5. Crear componente PublicRepresentanteLegalForm
6. Crear pagina RegistroInmobiliaria
7. Agregar ruta en App.tsx
8. Implementar logica de aprobacion
9. Pruebas end-to-end

