
# Plan: Corregir actualización de email de usuario

## Problema Identificado

El error ocurre porque:
- La tabla `logs_actividad` tiene una llave foránea `logs_actividad_usuario_id_fkey` que referencia `usuarios.email`
- La tabla `proyectos_acceso` tiene una llave foránea `fk_proyectos_acceso_usuarios` que referencia `usuarios.email`
- Ambas tienen la regla `ON UPDATE NO ACTION`, lo que **bloquea** cualquier cambio al email si hay registros relacionados

Cuando intentas cambiar el email de `margot.lasrosas1297@gmail.com` a `margot.lasrosas1297x@gmail.com`, PostgreSQL rechaza la operación porque hay logs de actividad registrados con ese email.

## Solución Propuesta

Modificar las llaves foráneas para usar `ON UPDATE CASCADE`, lo que automáticamente actualizará el email en las tablas relacionadas cuando cambie en `usuarios`.

### Migración SQL

```sql
-- 1. Modificar logs_actividad para usar CASCADE en updates
ALTER TABLE logs_actividad 
DROP CONSTRAINT logs_actividad_usuario_id_fkey;

ALTER TABLE logs_actividad 
ADD CONSTRAINT logs_actividad_usuario_id_fkey 
FOREIGN KEY (usuario_id) REFERENCES usuarios(email) 
ON UPDATE CASCADE ON DELETE NO ACTION;

-- 2. Modificar proyectos_acceso para usar CASCADE en updates
ALTER TABLE proyectos_acceso 
DROP CONSTRAINT fk_proyectos_acceso_usuarios;

ALTER TABLE proyectos_acceso 
ADD CONSTRAINT fk_proyectos_acceso_usuarios 
FOREIGN KEY (usuario_id) REFERENCES usuarios(email) 
ON UPDATE CASCADE ON DELETE NO ACTION;
```

### Comportamiento Después del Cambio

Cuando actualices el email de un usuario:
1. ✅ Se actualizará en `auth.users` (vía edge function)
2. ✅ Se actualizará en `usuarios` (vía edge function)
3. ✅ Se propagará automáticamente a `logs_actividad.usuario_id`
4. ✅ Se propagará automáticamente a `proyectos_acceso.usuario_id`
5. ✅ Se propagará automáticamente a `ofertas.email_creador` (ya tenía CASCADE)

---

## Detalles Técnicos

### Archivos a Modificar
| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Alterar las constraints de FK para usar `ON UPDATE CASCADE` |

### Riesgos y Mitigaciones
- **Riesgo**: Ninguno significativo. `ON UPDATE CASCADE` es la práctica estándar para este tipo de relaciones
- **Impacto**: Cero downtime, la migración es instantánea

### Orden de Ejecución
1. Ejecutar migración SQL para modificar las constraints
2. Probar actualización de email del usuario

¿Apruebas este plan para implementarlo?
