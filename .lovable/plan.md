

## Diagnóstico

Después de revisar BD y código, el agente **SÍ existe** y está correctamente vinculado:

- Usuario `ivandelatorre_@hotmail.com` → `id_persona=2483`, `rol_id=3` (Agente Inmobiliario), `activo=true`.
- Relación `entidades_relacionadas` id=3604: `id_persona=2483` ↔ `id_persona_duena_lead=2687` (Invierte y Vive MX), `id_tipo_entidad=19`, `activo=true`. ✅

El motivo por el cual la pestaña "Activos (0)" no lo muestra es **una RLS faltante en la tabla `usuarios`**.

### Causa raíz

El hook `useInmobAgents` ejecuta tres queries:
1. `entidades_relacionadas` filtrando por `id_persona_duena_lead = 2687` y `id_tipo_entidad = 19` → devuelve `id_persona=2483` ✅ (la RLS de esta tabla permite el caso `id_tipo_entidad NOT IN (2,7)`).
2. `usuarios.select(email, id_persona, activo).in('id_persona', [2483])` → **devuelve 0 filas** ❌
3. `personas` → no se ejecuta porque no hay usuarios.

Las políticas SELECT actuales sobre `public.usuarios` son:
- `Super admins can view all users` — solo Super Admin.
- `Internal roles can view all users` — solo roles internos (Sozu).
- `Users can view own record` — solo el propio registro.
- `Anon puede verificar email de clientes` — solo `rol_id = 23`.

**Una Inmobiliaria (rol 4) no califica en ninguna**, por lo que `usuarios` se filtra a vacío y el hook devuelve `[]`. Por eso la lista aparece en cero, los filtros tampoco encuentran al agente, y los demás portales del Inmob (Pipeline, Comisiones, Citas, Reportes) que también dependen de `useInmobAgents` están afectados con el mismo problema.

## Cambios

### 1. Migración: nueva policy SELECT en `public.usuarios`

Crear una policy que permita a una Inmobiliaria (rol 4) leer los registros de `usuarios` cuyo `email` corresponda a un agente vinculado a esa inmobiliaria vía `entidades_relacionadas` tipo 19. Reutilizar la función ya existente `is_inmob_agent_owner(text)` (SECURITY DEFINER, evita recursión RLS):

```sql
CREATE POLICY "Inmob owners can view their agents"
ON public.usuarios
FOR SELECT
TO authenticated
USING ( public.is_inmob_agent_owner(email) );
```

Esa función ya cubre los casos:
- Super Admin / Admin Proyecto → acceso total (devuelve true para cualquier email).
- Inmobiliaria (rol 4) con `id_persona` → ve solo a sus agentes tipo 19.
- Agentes (rol 3/9) consultando agentes de su misma inmobiliaria.
- Inmobiliarias secundarias resueltas vía `proyectos_acceso`.

No reemplaza ni rompe las policies existentes; se agrega como condición OR.

### 2. Sin cambios de código frontend

`useInmobAgents`, `InmobAgentes`, `InmobPipeline`, `InmobComisiones`, `InmobCitas`, `InmobReportes` y `InmobDashboard` ya tienen la lógica correcta. Una vez aplicada la policy, todos verán a sus agentes automáticamente.

### 3. Validación posterior

Tras la migración, verificar:
- `invierteyvivemx@gmail.com` ve a Félix Iván De La Torre Ramírez en la pestaña **Activos**.
- KPIs de Pipeline/Comisiones/Citas para esa inmobiliaria reflejan los datos del agente.
- Sozu (rol 1) sigue viendo todos los usuarios sin cambios.
- Un agente de OTRA inmobiliaria no aparece en la lista de Invierte y Vive (la función filtra por `id_persona_duena_lead`).

## Resultado esperado

La inmobiliaria `invierteyvivemx@gmail.com` (y cualquier otra inmobiliaria rol 4) podrá ver correctamente a sus agentes vinculados en todos los módulos del Portal Inmobiliaria, sin exponer datos de agentes de otras inmobiliarias.

