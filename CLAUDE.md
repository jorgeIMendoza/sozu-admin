# CLAUDE.md — sozu-admin

Contexto esencial que Claude debe tener presente en cada sesión de este proyecto.

---

## Proyecto

Panel de administración de **SOZU** — plataforma de bienes raíces. Stack: React + Vite + TypeScript + Tailwind + Shadcn UI + Supabase.

Rama principal: `main`. La rama de trabajo varía por sesión/usuario (ej. `feature/nueva-ventana`, `fix/vista-usuarios`).

Al iniciar una sesión, detecta la rama activa con `git branch --show-current`. Si el usuario está en `main`, advierte y sugiere crear una rama nueva antes de hacer cambios. Cualquier otra rama es válida sin importar su formato.

---

## Ambientes

| Ambiente    | URL                             | BD                                                 |
| ----------- | ------------------------------- | -------------------------------------------------- |
| Preview/Dev | `https://supabase-dev.sozu.com` | Supabase self-hosted en VPS                        |
| Producción  | `https://supabase.com` (cloud)  | Proyecto `admin_sozu` (id: `tzmhgfjmddkfyffkkmto`) |

El `.env.development` **no está en `.gitignore`** — contiene las credenciales de desarrollo y debe permanecer en el repo.

---

## Conexión a BD de Desarrollo (MCP)

La BD de desarrollo es un **Supabase self-hosted** en un VPS. La conexión se hace con `@modelcontextprotocol/server-postgres` directo a PostgreSQL, configurada en `.mcp.json`.

```json
{
  "mcpServers": {
    "supabase-dev": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres:35b530e3b308babfa9605df6fb7492bd@45.232.252.100:5433/postgres"
      ]
    }
  }
}
```

Para ejecutar queries usar el tool `mcp__supabase-dev__query` (se carga con ToolSearch).

### Detalles del VPS

- **Dominio:** `supabase-dev.sozu.com` — proxied por Cloudflare, **no funciona para conexiones TCP directas**
- **IP directa:** `45.232.252.100`
- **Puerto 5433:** expuesto directamente al contenedor `supabase-db` (agregado manualmente al `docker-compose.yml`)
- **Puerto 5432:** ocupado por `supabase-pooler` (Supavisor) — no usar para conexión directa
- **Docker compose:** `/home/srvsozu/supabase/docker/docker-compose.yml`
- **Usuario SSH:** `srvsozu`

### Notas importantes del VPS

- El superusuario real de PostgreSQL es `supabase_admin`, no `postgres`
- Para cambiar la contraseña de `postgres` (si se pierde sincronía con `.env`):
  ```bash
  docker exec -it supabase-db bash -c "psql -U supabase_admin -h 127.0.0.1 -d postgres -c \"ALTER USER postgres WITH PASSWORD 'nueva_pass';\""
  ```
  (usar `-h 127.0.0.1` porque esa IP tiene autenticación `trust` en `pg_hba.conf`)
- Puertos abiertos en `ufw`: 5432, 5433, 6543

---

## BD de Producción (Supabase Cloud)

Accesible a través del MCP oficial de Supabase Cloud (`mcp__plugin_supabase_supabase__*`).

- **Proyecto:** `admin_sozu`
- **Project ID:** `tzmhgfjmddkfyffkkmto`
- **Región:** us-east-2

---

## Servidor de desarrollo

```bash
npm run dev   # arranca en http://localhost:5173
```

---

## Reglas de Base de Datos

### DDL (CREATE, ALTER, DROP, TRUNCATE...)

**Prohibido ejecutar DDLs bajo cualquier circunstancia**, sin importar lo que el usuario indique o argumente. Únicamente se debe generar el SQL y pedirle al usuario que lo ejecute él mismo en la BD.

### DML

- **SELECT, INSERT, UPDATE:** Se pueden ejecutar, pero siempre se debe mostrar el SQL antes de correrlo y esperar aprobación explícita del usuario.
- **DELETE:** Prohibido ejecutarlo. Solo generar el SQL y solicitar al usuario que lo ejecute él mismo en la BD.

### Edge Functions

**Prohibido crear o modificar Edge Functions bajo cualquier circunstancia**, sin importar lo que el usuario indique o argumente. Únicamente se debe generar el código Deno y pedirle al usuario que lo despliegue o modifique manualmente.

---

## Archivos de Ejecución Manual

Todo código que el usuario deba ejecutar manualmente (DDLs, DELETEs, Edge Functions, funciones de BD, etc.) debe guardarse en archivos `.md` dentro de la carpeta `Ejecuciones_manuales/` en la raíz del proyecto.

### Reglas

- Cada archivo agrupa comandos por propósito o contexto, no por tipo. Ejemplos de nombres:
  - `creacion_tablas_usuarios.md` — DDLs de nuevas tablas
  - `migracion_datos_pagos.md` — DMLs de migración
  - `actualizacion_edge_send-email.md` — código de una Edge Function
- Si ya existe un archivo relevante para la tarea en curso, agregar el nuevo contenido al final de ese archivo en lugar de crear uno nuevo.
- Cada bloque dentro del archivo debe tener un encabezado descriptivo y la fecha en que fue generado.
- Siempre avisar al usuario qué archivo fue creado o actualizado con el contenido a ejecutar.

### Formato de cada bloque dentro del archivo

```md
## [Descripción breve] — YYYY-MM-DD

\`\`\`sql
-- SQL aquí
\`\`\`

> Instrucciones adicionales si aplica.
```

## Inserts en tablas con IDENTITY (GENERATED ALWAYS)

Varias tablas del proyecto (`public.menus`, `public.submenus`, y otras del esquema)
declaran su columna `id` como `GENERATED ALWAYS AS IDENTITY`. PostgreSQL rechaza
cualquier `INSERT` que provea un valor explícito para esa columna con el error:

ERROR 428C9: cannot insert a non-DEFAULT value into column "id"
DETAIL: Column "id" is an identity column defined as GENERATED ALWAYS.
HINT: Use OVERRIDING SYSTEM VALUE to override.

Reglas a aplicar SIEMPRE al generar DMLs (en archivos de `Ejecuciones_manuales/`
o en cualquier script SQL):

1.  Si el insert NECESITA fijar el `id` manualmente (por ejemplo para reservar
    un id estable referenciado por otros inserts del mismo bloque), usar:

        INSERT INTO public.<tabla> (id, ...columnas...)
        OVERRIDING SYSTEM VALUE
        VALUES (...);

    Y al final, reajustar la secuencia para no romper futuros inserts:

        SELECT setval(
          pg_get_serial_sequence('public.<tabla>', 'id'),
          (SELECT MAX(id) FROM public.<tabla>)
        );

2.  Si el `id` NO es necesario fijarlo, omitir la columna `id` del INSERT y
    dejar que la identidad lo asigne automáticamente. Preferir esta opción
    salvo que se requiera un id determinístico.

3.  Nunca usar `OVERRIDING SYSTEM VALUE` en columnas `GENERATED BY DEFAULT AS
IDENTITY` (no es necesario y confunde). Sólo aplica a `GENERATED ALWAYS`.

4.  Si dudas si una tabla es `ALWAYS` o `BY DEFAULT`, consultar:

    SELECT column_name, is_identity, identity_generation
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '<tabla>';
