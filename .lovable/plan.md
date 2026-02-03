

## Plan: Crear Usuarios Faltantes para Inmobiliarias y Representantes

### Problema Identificado

Según el análisis de la base de datos, hay **7 usuarios faltantes**:

| Tipo | Email | Nombre | Rol Esperado |
|------|-------|--------|--------------|
| Inmobiliaria | broker@independiente.mx | BROKER INDEPENDIENTE | Inmobiliaria (4) |
| Inmobiliaria | contacto@brokersandbrothers.com | Brokers and Brothers | Inmobiliaria (4) |
| Inmobiliaria | brokers@yopmail.com | Brokers de inmo | Inmobiliaria (4) |
| Inmobiliaria | minuevainmo@yopmail.com | Mi nueva Inmo | Inmobiliaria (4) |
| Inmobiliaria | contacto@vivaltainmobiliaria.com | VIVALTA | Inmobiliaria (4) |
| Rep. Legal | eduardo@brokersbrothers.com | Eduardo Ochoa | Agente Inmobiliario (3) |
| Rep. Legal | jo17rge@gmail.com | Jorge Torres Romo | Agente Inmobiliario (3) |

---

### Solución: Nueva Edge Function para Migración Dinámica

Crear una nueva Edge Function `migrate-missing-users` que:

1. **Detecta dinámicamente** todas las inmobiliarias activas sin usuario
2. **Detecta representantes** (legal y comercial) sin usuario
3. Soporta modo **dry_run** para previsualizar antes de ejecutar
4. Crea los usuarios faltantes con contraseña temporal `Temporal123!`

---

### Archivos a Modificar/Crear

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/migrate-missing-users/index.ts` | Nueva Edge Function |
| `supabase/config.toml` | Registrar nueva función |

---

### Lógica de la Edge Function

```text
1. Recibir parámetro: { dry_run: boolean }

2. Consultar inmobiliarias activas (tipo_entidad = 5)
   ├─ Obtener email, nombre_legal, id_persona
   ├─ Verificar si existe usuario con rol_id = 4 y ese email
   └─ Si no existe → agregar a lista de usuarios a crear

3. Consultar representantes (legales y comerciales) de inmobiliarias activas
   ├─ Obtener datos desde id_entidad_relacionada_rep_leg y rep_com
   ├─ Verificar si existe usuario con rol_id = 3 y ese email
   └─ Si no existe → agregar a lista de usuarios a crear

4. Si dry_run = true
   └─ Retornar lista de usuarios que SE CREARÍAN

5. Si dry_run = false
   ├─ Para cada usuario faltante:
   │   ├─ Crear auth user (o reutilizar existente)
   │   ├─ Crear registro en tabla usuarios
   │   └─ Crear entidad_relacionada si es agente
   └─ Retornar resultados
```

---

### Flujo de Uso

1. **Previsualizar** (desde consola o Postman):
```bash
POST /migrate-missing-users
Body: { "dry_run": true }
```
→ Retorna lista de 7 usuarios que se crearían

2. **Ejecutar migración**:
```bash
POST /migrate-missing-users
Body: { "dry_run": false }
```
→ Crea los 7 usuarios y retorna resultados

---

### Detalles Técnicos de la Edge Function

**Consulta para encontrar inmobiliarias sin usuario:**
```sql
-- Inmobiliarias activas con email
SELECT p.id, p.nombre_legal, p.email
FROM personas p
JOIN entidades_relacionadas er ON er.id_persona = p.id
WHERE er.id_tipo_entidad = 5  -- Inmobiliaria
  AND er.activo = true
  AND p.activo = true
  AND p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u 
    WHERE u.email = p.email 
      AND u.rol_id = 4 
      AND u.activo = true
  )
```

**Consulta para encontrar representantes sin usuario:**
```sql
-- Representantes de inmobiliarias activas sin usuario
SELECT DISTINCT rep_persona.id, rep_persona.nombre_legal, rep_persona.email, 
       inmo_persona.id as inmobiliaria_id
FROM personas inmo_persona
JOIN entidades_relacionadas inmo_er ON inmo_er.id_persona = inmo_persona.id
JOIN entidades_relacionadas rep_er ON rep_er.id IN (
  inmo_persona.id_entidad_relacionada_rep_leg,
  inmo_persona.id_entidad_relacionada_rep_com
)
JOIN personas rep_persona ON rep_persona.id = rep_er.id_persona
WHERE inmo_er.id_tipo_entidad = 5
  AND inmo_er.activo = true
  AND rep_persona.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u 
    WHERE u.email = rep_persona.email 
      AND u.rol_id = 3 
      AND u.activo = true
  )
```

---

### Estructura de Respuesta

**dry_run = true:**
```json
{
  "dry_run": true,
  "users_to_create": [
    { "email": "broker@independiente.mx", "nombre": "BROKER INDEPENDIENTE", "rol": "Inmobiliaria", "tipo": "inmobiliaria" },
    { "email": "eduardo@brokersbrothers.com", "nombre": "Eduardo Ochoa", "rol": "Agente Inmobiliario", "tipo": "rep_legal" }
  ],
  "total": 7
}
```

**dry_run = false:**
```json
{
  "dry_run": false,
  "results": [
    { "email": "...", "success": true, "message": "Usuario creado" },
    { "email": "...", "success": false, "error": "Ya existe" }
  ],
  "summary": { "total": 7, "created": 5, "failed": 2 },
  "temp_password": "Temporal123!"
}
```

---

### Seguridad

- Requiere autenticación JWT
- Solo ejecutable por usuarios con rol **Super Administrador**
- Logs detallados para auditoría

---

### Resultado Esperado

Al ejecutar la migración:
- Se crearán los 7 usuarios faltantes
- Cada uno tendrá contraseña temporal `Temporal123!`
- Los usuarios de inmobiliaria tendrán rol_id = 4
- Los representantes tendrán rol_id = 3 y se vincularán a su inmobiliaria

