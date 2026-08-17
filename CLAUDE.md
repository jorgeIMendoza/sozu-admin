# CLAUDE.md — sozu-admin

Contexto esencial por sesión.

---

## Proyecto

Panel admin **SOZU** — plataforma bienes raíces. Stack: React 18 + Vite + TypeScript + Tailwind + Shadcn UI + Supabase (PostgreSQL + Edge Functions + Storage + Auth).

Docs técnicos: `https://github.com/jorge-mendoza-corella/sozu-docs` (privado).
gh CLI autenticado como `tomaspeterson-prog` en `C:\Users\Tomas\gh-cli\bin\gh.exe`.

Rama principal: `main`. Rama de trabajo varía por sesión/usuario (ej. `cambios_tomas`).

Al iniciar sesión, detecta rama activa con `git branch --show-current`. Si usuario en `main`, advertir + sugerir nueva rama antes de cambios. Cualquier otra rama válida sin importar formato.

---

## Regla de desarrollo — estructura fija, sin prototipos (vigente desde 2026-07-27)

**No crear nuevas carpetas ni reorganizar el repositorio.** Trabajar únicamente con la estructura existente:

- `Ejecuciones_manuales/` — documentación operativa (ver sección "Archivos de Ejecución Manual").
- `src/` — implementación real del frontend (y wrappers/hooks que llaman a Supabase).
- `supabase/` — se mantiene exactamente como está (`config.toml`, `migrations/` con su historial de Lovable/Producción). No se crean migraciones nuevas ahí como parte de este flujo. `supabase/functions/` está prácticamente vacío a propósito: las Edge Functions viven en el repo `sozu-edge-functions` (ver su `README.md`).

**No generar archivos `.html` de prototipos, mockups o diseños.** Toda implementación de UI se realiza directamente sobre los componentes React reales del proyecto y se valida en la ruta real de la aplicación corriendo (ej. `http://localhost:8080/admin/portal-juridico/inicio`), nunca en un archivo estático aparte.

- ✅ Se trabaja únicamente sobre `src/` y las rutas reales.
- ✅ Los cambios se validan en la app real corriendo en `localhost:8080`.
- ❌ No se generan prototipos HTML independientes.
- ❌ No se crean aplicaciones paralelas ni pantallas duplicadas fuera del flujo existente.
- ❌ No se crean carpetas nuevas para reorganizar documentación o código.

---

## Package Manager

**Siempre usar `pnpm`. Nunca `npm`, `yarn` ni `bun`.**

`package.json` tiene `"packageManager": "pnpm@11.5.0"` + script `preinstall` que rechaza otros package managers. `npm install` o `bun install` falla con error explícito. Lock file oficial: `pnpm-lock.yaml` — nunca commitear `package-lock.json` ni `bun.lock`.

---

## Ambientes

| Ambiente    | URL                             | BD                                                 |
| ----------- | ------------------------------- | -------------------------------------------------- |
| Preview/Dev | `https://supabase-dev.sozu.com` | Supabase self-hosted en VPS                        |
| Producción  | `https://supabase.com` (cloud)  | Proyecto `admin_sozu` (id: `tzmhgfjmddkfyffkkmto`) |

`.env.development` **no está en `.gitignore`** — contiene credenciales dev, debe permanecer en repo.

---

## Conexión a BD de Desarrollo (MCP)

BD dev = **Supabase self-hosted** en VPS. Conexión via `@modelcontextprotocol/server-postgres` directo a PostgreSQL, configurada en `.mcp.json` (ver ese archivo para la cadena de conexión). Queries via tool `mcp__supabase-dev__query` (cargar con ToolSearch).

### Detalles del VPS

- **Dominio:** `supabase-dev.sozu.com` — proxied por Cloudflare, **no funciona para conexiones TCP directas**
- **IP directa:** `45.232.252.100`
- **Puerto 5433:** expuesto directamente al contenedor `supabase-db` (agregado manualmente al `docker-compose.yml`)
- **Puerto 5432:** ocupado por `supabase-pooler` (Supavisor) — no usar para conexión directa
- **Docker compose:** `/home/srvsozu/supabase/docker/docker-compose.yml`
- **Usuario SSH:** `srvsozu`

### Notas importantes del VPS

- Superusuario real PostgreSQL = `supabase_admin`, no `postgres`
- Cambiar contraseña de `postgres` (si pierde sincronía con `.env`):
  ```bash
  docker exec -it supabase-db bash -c "psql -U supabase_admin -h 127.0.0.1 -d postgres -c \"ALTER USER postgres WITH PASSWORD 'nueva_pass';\""
  ```
  (`-h 127.0.0.1` porque esa IP tiene autenticación `trust` en `pg_hba.conf`)
- Puertos abiertos en `ufw`: 5432, 5433, 6543

---

## BD de Producción (Supabase Cloud)

Accesible via MCP oficial Supabase Cloud (`mcp__plugin_supabase_supabase__*`).

- **Proyecto:** `admin_sozu`
- **Project ID:** `tzmhgfjmddkfyffkkmto`
- **Región:** us-east-2

---

## Servidor de desarrollo

**Al iniciar cada sesión**, verificar si servidor corre:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null
# 200 → ya está corriendo, no hacer nada
# otro → levantarlo con el comando de abajo
```

Levantar (usar pnpm — ruta completa porque no está en PATH por defecto):

```bash
cd "/c/Users/Tomas/Documents/Proyecto SOZU/sozu-admin"
"/c/Users/Tomas/AppData/Roaming/npm/pnpm.cmd" run dev -- --host
```

- Puerto: **http://localhost:8080** (no 5173)
- Red local: **http://10.200.195.170:8080**
- Ejecutar en background si se necesita trabajar en paralelo

---

## Reglas de Base de Datos

### Usuario propietario

`jorge.mendoza@sozu.com` = propietario del sistema. Si él solicita DDLs, DELETEs o modificar Edge Functions, **permitido directamente** sin restricciones. Reglas restrictivas aplican solo a cualquier otro usuario.

---

### DDL (CREATE, ALTER, DROP, TRUNCATE, CREATE FUNCTION/RPC, CREATE INDEX...)

**Prohibido ejecutar DDLs bajo cualquier circunstancia**, sin importar lo que usuario indique. Todo DDL se entrega exclusivamente como documento Markdown (`.md`) dentro de `Ejecuciones_manuales/` — ver sección "Archivos de Ejecución Manual" más abajo para la estructura obligatoria. **No se generan archivos `.sql` independientes en el repositorio ni se solicitan consultas SQL ad hoc por chat** (regla definitiva vigente desde 2026-07-27).

**Verificaciones permitidas sin aprobación previa:** consultas de solo lectura (introspección, `pg_get_functiondef`, `information_schema`, etc.) y UAT transaccional en bloques `BEGIN...ROLLBACK` sobre Preview pueden ejecutarse directamente durante el desarrollo, siempre que no modifiquen datos de forma permanente. Esto acelera la validación sin sacrificar la regla de no-DDL-directo.

**Excepción:** si usuario es `jorge.mendoza@sozu.com`, ejecutar DDL directamente previa confirmación explícita.

### DML

- **SELECT, INSERT, UPDATE:** Ejecutar, pero siempre mostrar SQL antes y esperar aprobación explícita.
- **DELETE:** Prohibido ejecutar. Solo generar SQL y solicitar al usuario que lo ejecute en BD.

**Excepción DELETE:** si usuario es `jorge.mendoza@sozu.com`, ejecutar DELETE directamente previa confirmación explícita.

### Edge Functions

**Prohibido crear o modificar Edge Functions bajo cualquier circunstancia**, sin importar lo que usuario indique. Solo generar código Deno y pedir al usuario desplegar/modificar manualmente.

**Excepción:** si usuario es `jorge.mendoza@sozu.com`, crear y modificar archivos Edge Functions directamente en repo local.

---

## Archivos de Ejecución Manual

**Regla definitiva (vigente desde 2026-07-27):** toda modificación de base de datos — DDL (`CREATE`/`ALTER`/`DROP`/`CREATE FUNCTION`/`CREATE INDEX`/triggers/RLS) y DML de negocio con aprobación explícita (`INSERT`/`UPDATE`/`DELETE`) — se entrega exclusivamente como un documento Markdown (`.md`) dentro de `Ejecuciones_manuales/` en raíz del proyecto. **No se generan archivos `.sql` independientes en el repositorio ni se solicitan consultas SQL ad hoc por chat.** El DDL/DML queda embebido como bloque de código dentro del `.md`, listo para copiar y ejecutar. La ejecución sigue siendo manual en Preview — Claude nunca ejecuta DDL directamente (salvo excepción de `jorge.mendoza@sozu.com`).

No usar `supabase/migrations/` para este trabajo — esa carpeta ya contiene un historial extenso y activo (Lovable.dev, ~660 archivos a la fecha) ligado al proyecto de Producción (`tzmhgfjmddkfyffkkmto` en `supabase/config.toml`), ajeno al ciclo de Preview de este proyecto. No mezclar.

### Estructura estándar obligatoria de cada documento

```md
# [Título descriptivo]

## Objetivo

Qué se construye/corrige y por qué.

## Auditoría

Estado actual verificado (definición viva en BD si aplica, comportamiento previo, discrepancias con documentación anterior).

## Diagnóstico

Riesgos identificados, decisiones de diseño y su justificación.

## DDL

\`\`\`sql
-- SQL completo, listo para copiar y ejecutar en Preview
-- (BEGIN...COMMIT, REVOKE/GRANT, COMMENT ON cuando aplique)
\`\`\`

## Validación

\`\`\`sql
-- Verificación estructural: firma, permisos, SECURITY DEFINER/INVOKER
\`\`\`

## UAT

\`\`\`sql
-- Casos en bloques BEGIN...ROLLBACK — sin datos residuales
\`\`\`

## Resultado esperado

Qué debe observarse tras ejecutar (valores, SQLSTATEs, efectos en otras tablas).
```

### Reglas de organización

- Nomenclatura: `YYYYMMDD_descripcion.md` (ej. `20260727_juridico_rpc_orquestador.md`).
- Cada archivo agrupa comandos por propósito/contexto, no por tipo.
- Si ya existe archivo relevante para la tarea en curso, agregar contenido al final en lugar de crear uno nuevo.
- Siempre avisar al usuario qué archivo fue creado/actualizado.

### Formato heredado (histórico, antes de 2026-07-27 — no usar para trabajo nuevo)

```md
## [Descripción breve] — YYYY-MM-DD

\`\`\`sql
-- SQL aquí
\`\`\`

> Instrucciones adicionales si aplica.
```

---

## Arquitectura de portales

App detecta subdominio en runtime y renderiza portal correspondiente:

| Portal | Subdominio | Ruta principal | Audiencia |
|---|---|---|---|
| Admin | `admin.sozu.com` | `/admin` | Super Admins |
| Agentes | `agentes.sozu.com` | `/admin/agent/*` | Agentes internos |
| Inmobiliarias | `inmobiliarias.sozu.com` | `/admin/portal-inmobiliaria/*` | Inmobiliarias externas |
| Clientes | `clientes.sozu.com` | `/admin/portal-cliente/*` | Compradores finales |
| Embajadores | `embajadores.sozu.com` | `/admin/portal-embajador/*` | Programa referidos |
| Cobranza | (admin) | `/admin/portal-cobranza/*` | Equipo cobranza |
| Escrituración | (admin) | `/admin/portal-escrituracion/*` | Equipo escrituración |
| Alta Dirección | (admin) | `/admin/portal-alta-direccion/*` | Directores |
| Jurídico | (admin) | `/admin/juridico/*` | Abogados |
| Notaría | (admin) | `/admin/portal-notaria/*` | Notarios |

Rutas `/admin/*` protegidas por `ProtectedRoute` (sesión) + `PermissionRoute` (rol).
Permisos dinámicos: hooks `useAllowedMenus`, `usePagePermissions`, `useProjectAccess`.

---

## Schema de Base de Datos — 128 tablas, 12 dominios

### Catálogos de estatus (ids críticos)

**`estatus_disponibilidad` (propiedades):**
| id | Nombre | Criterio |
|---|---|---|
| 1 | Inventario | Alta inicial |
| 2 | Disponible | En venta |
| 4 | Apartada | Apartado pagado |
| 5 | Vendido | Enganche + contrato verificado |
| 7 | Escrituración | Datos notariales + saldo ≤ $0.01 |
| 8 | Entregada | Acta de entrega firmada |
| 9 | Pagada completamente | Todos acuerdos completados |

Dashboards entregas/postventa: `id_estatus_disponibilidad IN (5, 7, 8, 9)`.

### Tablas por dominio (más usadas)

**Catálogos:** `paises`, `estados_mx`, `municipios_mx`, `bancos`, `conceptos_pago`, `metodos_pago`

**Personas:** `personas` (tabla central), `entidades_relacionadas`, `compradores` (PK compuesta), `beneficiarios`, `cuentas_bancarias`

**Proyectos:** `proyectos` → `edificios` → `edificios_modelos` ↔ `modelos` → `propiedades`

**Inventario:** `propiedades`, `bodegas`, `estacionamientos`, `productos_servicios`

**Comercialización:** `ofertas`, `esquemas_pago`

**Cobranza/Pagos (crítico):**
```
cuentas_cobranza (precio_final, clabe_stp, valor_uma, fecha_compra)
  → acuerdos_pago (monto, pago_completado, id_concepto)
    → aplicaciones_pago (monto, es_multa) ← fuente de "total pagado"
  → pagos (monto, fecha_pago, clave_rastreo, url_cep)
  → multas
```

**Documentos:** `documentos` (id_tipo_documento), `firmas_digitales`, `cartas_acuerdo`

**Citas:** `reservas_citas`, `tipos_cita`

**Seguridad:** `roles`, `menus`, `submenus`, `submenus_permisos`, `proyectos_acceso`, `usuarios`

**Postventa:** `postventa_tickets`, `postventa_categorias_garantia`, `postventa_categorias_personal`

**Jurídico:** `demandas`, `demandas_timeline`, `app_juridico_documentos`

### IDs fijos importantes

**`tipos_entidad` (entidades_relacionadas.id_tipo_entidad):**
`2`=Comprador/Lead · `3`=Agente inmob · `4`=Inmobiliaria · `5`=SOZU · `7`=Prospecto · `8`=Proveedor · `9`=Agente interno Sozu

**`tipos_documento`:**
`6`=Constancia fiscal · `18`=Contrato firmado · `21`=Factura XML · `22`=Factura PDF · `24`=Acta de entrega · `44`=Archivo SAT · `48`=Carta comercialización

**`roles` (usuarios.rol_id)** — verificado contra **prod** (`tzmhgfjmddkfyffkkmto`) el 2026-07-31.
Fuente de la verdad = la BD de producción, no este documento. Entre paréntesis, usuarios activos:

`1`=Super Administrador (8) · `2`=Administrador de Proyecto (2) · `3`=**Agente Inmobiliario** (326) ·
`4`=Inmobiliaria (829) · `6`=Notario (10) · `7`=Administrador de finanzas/legal (12) ·
`8`=Solo Lectura (1) · `9`=**Agente Interno** (1) · `10`=Administrador de data (1) ·
`12`=**Administrador de cobranza** (3) · `14`=Representante de empresa dueña (1) ·
`17`=Gerente general (1) · `18`=Admin Legal (2) · `19`=Directores (1) ·
`21`=Administrador de finanzas/contabilidad (1) · `22`=Administracion de pagos interna (1) ·
`23`=Cliente (622) · `24`=Operacion de Mantenimiento (4) · `25`=Embajador (5) ·
`30`=Admin Soporte (2) · `31`=Supervisor agentes externos (1) · `32`=Supervisor Banco (2) ·
`34`=Admin de clientes (1) · `37`=Supervisor Condominio (1)

Sin usuarios activos hoy (existen en el catálogo): `5`=Vendedor · `11`=Documentador Escrituras ·
`13`=Supervisor de ventas · `15`=Desarrollador · `16`=Gestion Mantenimiento · `26`=Jurídico ·
`28`=Banco · `29`=Admin de escrituracion · `33`=Operador Banco · `35`=Usuario CRM ·
`36`=Socio Bancario · `38`=Operador Condomino · `39`=Soporte tickets.
Inactivo: `27`=Administrador Legal.

> **Ojo:** hasta 2026-07-31 este documento decía `3`=Agente Interno y `2`=Admin Cobranza. Es
> falso: el 3 son los **326 agentes inmobiliarios externos**, el Agente Interno es el `9` y
> Cobranza es el `12`. Dar un permiso al `3` creyendo que es interno lo abre a todos los
> externos. Confirmar siempre con `SELECT id, nombre FROM roles WHERE activo = true`.

---

## Patrones críticos de queries

### 1. Waterfall explícito (NUNCA PostgREST triple join)

```ts
// ✅ CORRECTO
const { data: edificios } = await supabase.from('edificios')
  .select('id').eq('id_proyecto', proyectoId).eq('activo', true);
const { data: modelos } = await supabase.from('edificios_modelos')
  .select('id').in('id_edificio', edificios.map(e => e.id));
const { count } = await supabase.from('propiedades')
  .select('*', { count: 'exact', head: true })
  .in('id_edificio_modelo', modelos.map(m => m.id)).eq('activo', true);

// ❌ INCORRECTO — falla silenciosamente
.select('id, edificios_modelos!inner(edificios!inner(id_proyecto))')
.eq('edificios_modelos.edificios.id_proyecto', id)
```

### 2. Suma de pagos: SIEMPRE sumar TODAS las cuentas de la propiedad

Propiedad puede tener **N cuentas de cobranza** (principal + bodega + estacionamiento).
Sumar solo una cuenta da totales incorrectos.

```ts
// 1. Todas las cuentas de la propiedad
const cuentas = await supabase.from('cuentas_cobranza')
  .select('id, id_propiedad, precio_final')
  .in('id_propiedad', propIds).eq('activo', true);

// 2. Pagos directos de TODAS las cuentas
const pagos = await supabase.from('pagos')
  .select('id_cuenta_cobranza, monto')
  .in('id_cuenta_cobranza', cuentas.map(c => c.id)).eq('activo', true);

// 3. Agrupar por propiedad
const pagosByProp = {}; // Record<propId, totalPagado>
for (const p of pagos) {
  const propId = cuentaPropMap[p.id_cuenta_cobranza];
  pagosByProp[propId] = (pagosByProp[propId] || 0) + Number(p.monto);
}
```

### 3. Filtro proyectos SOZU

```ts
// Paso 1: proyectos asignados a SOZU
const rels = await supabase.from('entidades_relacionadas')
  .select('id_proyecto').eq('id_tipo_entidad', 5).eq('activo', true);

// Paso 2: proyectos publicados
const proyectos = await supabase.from('proyectos')
  .select('id, nombre').in('id', rels.map(r => r.id_proyecto))
  .eq('publicar', true).eq('activo', true).order('nombre');
```

### 4. Wizard de unidades: usar wizardProyectoId, NO filtro del dashboard

```ts
// ✅ queryKey incluye wizardProyectoId (selección del wizard)
queryKey: ['wizard-unidades', wizardProyectoId]  // NO proyectoId del dashboard
enabled: open && wizardProyectoId !== null
```

### 5. RPC con búsqueda server-side (evitar límite 5000)

```ts
// ✅ Pasar search al RPC para datasets grandes
supabase.rpc('get_relacion_pagos', { p_search: search || null, p_limit: 5000 })
```

### 6. DDL probe (graceful fallback)

```ts
const probe = await (supabase as any).from('tabla_nueva').select('id').limit(0);
const exists = !probe.error;
if (!exists) { /* mostrar banner DDL pendiente, devolver [] */ }
```

### 7. Dropdown inline (evitar clipping por overflow-y-auto)

No usar `position: absolute` dentro de contenedores con `overflow-y-auto`.
Usar lista inline en flujo normal del documento. `onBlur` + `setTimeout(150)` para cerrar.

### 8. Tablas sin tipos generados

```ts
// Usar cast para tablas que no están en los tipos de Supabase
const { data } = await (supabase as any).from('postventa_tickets').select('...');
```

---

## Flujo de ciclo de vida de una propiedad

```
LEAD → OFERTA → APARTADA(4) → VENDIDA(5) → PAGADA(9) → ESCRITURACIÓN(7) → ENTREGADA(8)
```

**Triggers automáticos en BD:**
- `trg_actualizar_estatus_propiedad_apartada` → apartado pagado (id_concepto=1) → estatus 4
- `trigger_actualizar_estatus_propiedad_pagada` → todos acuerdos completados → estatus 9
- `trigger_actualizar_estatus_escrituracion` → datos notariales en cuenta → estatus 7
- `trigger_create_client_user_on_comprador` → INSERT compradores → crea usuario auth
- `ajustar_ultimo_acuerdo_pago` → suma acuerdos = precio_final (tolerancia ±$0.01)

---

## Mapa Detalle Cuenta de Cobranza (CC-XXXXXX)

| Campo mostrado | Tabla | Columna/Cálculo |
|---|---|---|
| Precio Final | `cuentas_cobranza` | `precio_final` |
| Total Pagado | `aplicaciones_pago` | `SUM(monto WHERE es_multa=false)` vía `acuerdos_pago` |
| Saldo Pendiente | — | `precio_final - total_pagado` |
| Durante obra | `acuerdos_pago` JOIN `conceptos_pago` | Pendiente de conceptos ≠ 'pago a contra entrega' |
| A la entrega | `acuerdos_pago` JOIN `conceptos_pago` | Pendiente de concepto 'pago a contra entrega' |
| Efectivo — Límite | `cuentas_cobranza` | `valor_uma × 8025` |
| Efectivo — Pagado | `pagos` | `SUM(monto WHERE id_metodos_pago=1)` |
| Valor escrituración | `cuentas_cobranza` | `precio_final` + bodegas/estac extra (via `bodegas`+`estacionamientos`+`ofertas`) |
| Proyecto | `proyectos` | Via: `propiedades → edificios_modelos → edificios → proyectos` |
| Modelo | `modelos` | Via: `propiedades → edificios_modelos → modelos` |
| Edificio | `edificios` | Via: `propiedades → edificios_modelos → edificios` |
| No. Propiedad | `propiedades` | `numero_propiedad` |
| Oferta | `ofertas` | `id` via `cuentas_cobranza.id_oferta` |
| Metraje | `propiedades` | `m2_interiores + m2_exteriores` |
| Precio por m² | — | `precio_final / m2_interiores` |
| Dueño | `personas` | Via: `propiedades.id_entidad_relacionada_dueno → entidades_relacionadas → personas` |
| CLABE STP | `cuentas_cobranza` | `clabe_stp` |
| Fecha Compra | `cuentas_cobranza` | `fecha_compra` |

---

## Edge Functions clave (Supabase Deno)

Su código fuente vive en el repo `sozu-edge-functions`, no en este. Ahí se editan y desde ahí se despliegan (`dev` → VPS, `main` → Supabase Cloud).

| Función | Cuándo usarla |
|---|---|
| `generar-estado-cuenta` | PDF estado de cuenta → Storage (URL 1 min) |
| `generar-contrato` | Draft contrato en Google Docs |
| `generar-draft-proyecto-escritura` | Draft .docx con template del notario |
| `check-property-sold-status` | Verificar si propiedad puede pasar a Vendida |
| `check-property-escrituracion-status` | Verificar si puede pasar a Escrituración |
| `asignar-propiedad` | Crear oferta+cuenta+acuerdo en cascada |
| `enviar-notificacion` | Email (Postmark) y/o WhatsApp (Evolution) |
| `generar-factura-comision-sozu` | Cuando propiedad → Vendida |
| `create-user` | Crear usuario en auth + tabla usuarios |
| `create-client-user` | Crear usuario Cliente (rol 23) |
| `ai-database-query` | Consultas IA en lenguaje natural (Gemini) |

---

## Errores frecuentes y sus correcciones

| Síntoma | Causa | Fix |
|---|---|---|
| Monto pagado = $0 en portal notaría | Solo suma cuenta del notario | Sumar TODAS las cuentas de la propiedad (pagos directos) |
| "No se encontró esa unidad" en wizard | Usa proyectoId del dashboard en query | Usar `wizardProyectoId` en queryKey, no `proyectoId` |
| KPI inventario = 0 | PostgREST triple-join falla silenciosamente | Waterfall multi-step explícito |
| Pagos truncados (81 de 107) | RPC sin search → límite 5000 corta resultados | Pasar `search` al RPC |
| Dos "Total Pagado" diferentes | Un card usa `pagos.monto`, otro `aplicaciones_pago` | Vista cuenta única: usar `aplicaciones_pago` (fuente de verdad) |
| ERROR 428C9 en INSERT | Columna `id` es `GENERATED ALWAYS` | Ver sección "Inserts en tablas con IDENTITY" abajo |

---

## Inserts en tablas con IDENTITY (GENERATED ALWAYS)

Varias tablas (`public.menus`, `public.submenus`, otras) declaran `id` como `GENERATED ALWAYS AS IDENTITY`. PostgreSQL rechaza INSERT con valor explícito en esa columna:

ERROR 428C9: cannot insert a non-DEFAULT value into column "id"
DETAIL: Column "id" is an identity column defined as GENERATED ALWAYS.
HINT: Use OVERRIDING SYSTEM VALUE to override.

Reglas a aplicar SIEMPRE al generar DMLs (en `Ejecuciones_manuales/` o cualquier script SQL):

1.  Si insert NECESITA fijar `id` manualmente (ej. reservar id estable referenciado por otros inserts del mismo bloque):

        INSERT INTO public.<tabla> (id, ...columnas...)
        OVERRIDING SYSTEM VALUE
        VALUES (...);

    Al final, reajustar secuencia para no romper futuros inserts:

        SELECT setval(
          pg_get_serial_sequence('public.<tabla>', 'id'),
          (SELECT MAX(id) FROM public.<tabla>)
        );

2.  Si `id` NO necesita fijarse, omitir columna `id` del INSERT y dejar que identidad lo asigne. Preferir esta opción salvo que se requiera id determinístico.

3.  Nunca usar `OVERRIDING SYSTEM VALUE` en columnas `GENERATED BY DEFAULT AS
IDENTITY` (no necesario, confunde). Solo aplica a `GENERATED ALWAYS`.

4.  Si dudas si tabla es `ALWAYS` o `BY DEFAULT`, consultar:

    SELECT column_name, is_identity, identity_generation
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '<tabla>';

---

## Menús y Submenús → Sistema de Roles y Permisos

Menús y submenús **no son solo navegación**: son base del sistema de roles y permisos. Menú/submenú no dado de alta en BD **no existe** para control de acceso y no aparece para ningún rol.

### Regla obligatoria

**Cada vez que usuario solicite (o se cree en front) nuevo menú o submenú** — nuevo portal, nueva sección, nueva ruta en `App.tsx` protegida por `PermissionRoute` — Claude **SIEMPRE** debe generar, además del código React, los `INSERT` correspondientes a estas tablas y guardarlos en `Ejecuciones_manuales/` (según convención "Archivos de Ejecución Manual"). Avisar al usuario qué archivo se creó/actualizó. Tarea de UI no se da por terminada sin entregar inserts de permisos.

### Modelo de datos

```
menus (id IDENTITY ALWAYS, nombre, orden=100, activo)
  └─ submenus (id IDENTITY ALWAYS, menu_id, nombre, vista_front_end, orden=100, activo, solo_usuarioa=false)
       ├─ submenus_permisos_disponibles (submenu_id, permiso_id, activo)  ← qué acciones OFRECE el submenú
       └─ submenus_permisos (submenu_id, permiso_id, rol_id, activo)      ← qué rol TIENE cada permiso (lo hace visible/usable)
```

- `submenus.vista_front_end` = ruta del front (debe existir como `<Route>` en `App.tsx`).
- `solo_usuarioa=true` marca submenú exclusivo de "Usuario A" (se pinta en azul en sidebar; ver `useDynamicMenus`).
- `submenus_permisos_disponibles` define catálogo de permisos posibles del submenú.
- `submenus_permisos` = asignación efectiva por rol. **Sin al menos una fila aquí, submenú no aparece para ese rol.**

**Catálogo `permisos` (permiso_id):**
`1`=leer · `2`=crear · `3`=actualizar · `4`=eliminar · `5`=aprobar · `6`=exportar · `8`=generar_oferta

**Roles (rol_id)** — los más usados, verificados en **prod** el 2026-07-31:
`1`=Super Administrador · `2`=Administrador de Proyecto · `3`=**Agente Inmobiliario** (externos, 326) ·
`4`=Inmobiliaria (829) · `9`=**Agente Interno** (1) · `12`=**Administrador de cobranza** (3) · `23`=Cliente (622).
Lista completa en la sección "IDs fijos importantes". Antes de escribir un `rol_id` a mano,
confirmar con `SELECT id, nombre FROM roles WHERE activo = true`: el `3` **no** es el agente
interno, y dárselo por error abre el submenú a los 326 agentes externos.

### Plantilla de INSERT (respeta IDENTITY ALWAYS — id se autogenera)

`menus` y `submenus` son `GENERATED ALWAYS` → **nunca** fijar `id`. Encadenar con CTEs `RETURNING` para obtener ids generados sin hardcodearlos:

```sql
-- Nuevo menú + submenú(s) + permisos disponibles + asignación a roles
BEGIN;

WITH nuevo_menu AS (
  -- Omitir este CTE si el submenú cuelga de un menú existente y usar
  -- (SELECT id FROM menus WHERE nombre='...') más abajo.
  INSERT INTO public.menus (nombre, orden, activo)
  VALUES ('Portal Ejemplo', 200, true)
  RETURNING id
),
nuevos_submenus AS (
  INSERT INTO public.submenus (menu_id, nombre, vista_front_end, orden, activo, solo_usuarioa)
  SELECT m.id, v.nombre, v.ruta, v.orden, true, false
  FROM nuevo_menu m
  CROSS JOIN (VALUES
    ('Dashboard',     '/admin/portal-ejemplo/dashboard', 10),
    ('Configuración', '/admin/portal-ejemplo/config',    20)
  ) AS v(nombre, ruta, orden)
  RETURNING id
),
-- Permisos DISPONIBLES del submenú (mínimo leer=1; agregar 2,3,4… según la vista)
disp AS (
  INSERT INTO public.submenus_permisos_disponibles (submenu_id, permiso_id, activo)
  SELECT s.id, p.permiso_id, true
  FROM nuevos_submenus s
  CROSS JOIN (VALUES (1),(2),(3),(4)) AS p(permiso_id)
  RETURNING submenu_id
)
-- ASIGNACIÓN a roles (lo que hace VISIBLE el submenú). Mínimo Super Admin (1).
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT s.id, p.permiso_id, r.rol_id, true
FROM nuevos_submenus s
CROSS JOIN (VALUES (1),(2),(3),(4)) AS p(permiso_id)
CROSS JOIN (VALUES (1)) AS r(rol_id);  -- añadir más rol_id según a quién deba aparecer

COMMIT;
```

> Solo submenú en menú existente: reemplazar CTE `nuevo_menu` por
> `(SELECT id FROM menus WHERE nombre = 'Portal Existente')` como `menu_id`.
> Verificar siempre que cada `vista_front_end` tenga su `<Route>` en `App.tsx`.