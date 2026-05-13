# CLAUDE.md — sozu-admin

Contexto esencial que Claude debe tener presente en cada sesión de este proyecto.

---

## Proyecto

Panel de administración de **SOZU** — plataforma de bienes raíces. Stack: React + Vite + TypeScript + Tailwind + Shadcn UI + Supabase.

Rama principal: `main`. La rama de trabajo varía por sesión/usuario (ej. `feature/nueva-ventana`, `fix/vista-usuarios`).

Al iniciar una sesión, detecta la rama activa con `git branch --show-current`. Si el usuario está en `main`, advierte y sugiere crear una rama nueva antes de hacer cambios. Cualquier otra rama es válida sin importar su formato.

---

## Ambientes

| Ambiente | URL | BD |
|---|---|---|
| Preview/Dev | `https://supabase-dev.sozu.com` | Supabase self-hosted en VPS |
| Producción | `https://supabase.com` (cloud) | Proyecto `admin_sozu` (id: `tzmhgfjmddkfyffkkmto`) |

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
