# DML puntual — `luis.munoz@investimento.mx` con roles 3 y 23

> Ejecutar **después** de `01_creacion_tablas_y_updates.md` (requiere la tabla `user_roles` y el backfill).

## 1) Asegurar rol 3 (Agente Inmobiliario) como principal

```sql
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
VALUES ('luis.munoz@investimento.mx', 3, true, true, 'system-fix-luis')
ON CONFLICT (email, rol_id) DO UPDATE
SET activo = true, es_principal = true;
```

## 2) Agregar rol 23 (Cliente) como secundario

```sql
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
VALUES ('luis.munoz@investimento.mx', 23, true, false, 'system-fix-luis')
ON CONFLICT (email, rol_id) DO UPDATE
SET activo = true;
```

## 3) Notas

- **No se modifica** `usuarios.rol_id` (sigue como 3 = Agente, su rol principal).
- El acceso al portal Cliente lo otorga la fila en `user_roles`.
- Para enviarle el correo de confirmación del portal Cliente, invocar la edge function `create-client-user` con `{ email: 'luis.munoz@investimento.mx', confirmAddRole: true }` (ver `03_edgefunction_create_client_user.md`).

## 4) Verificación

```sql
SELECT email, rol_id, activo, es_principal, creado_por
FROM public.user_roles
WHERE email = 'luis.munoz@investimento.mx'
ORDER BY rol_id;
-- Debe regresar 2 filas: rol 3 (principal=true) y rol 23 (principal=false).
```
