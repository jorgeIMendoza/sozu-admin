# CLAUDE.md — sozu-admin

Contexto esencial que Claude debe tener presente en cada sesión de este proyecto.

---

## Proyecto

Panel de administración de **SOZU** — plataforma integral de bienes raíces. Stack: React 18 + Vite + TypeScript + Tailwind + Shadcn UI + Supabase (PostgreSQL + Edge Functions + Storage + Auth).

Documentación técnica completa en: `https://github.com/jorge-mendoza-corella/sozu-docs` (privado).
gh CLI autenticado como `tomaspeterson-prog` en `C:\Users\Tomas\gh-cli\bin\gh.exe`.

Rama principal: `main`. La rama de trabajo varía por sesión/usuario (ej. `cambios_tomas`).

Al iniciar una sesión, detecta la rama activa con `git branch --show-current`. Si el usuario está en `main`, advierte y sugiere crear una rama nueva antes de hacer cambios. Cualquier otra rama es válida sin importar su formato.

---

## Package Manager

**Siempre usar `pnpm`. Nunca `npm`, `yarn` ni `bun`.**

- Instalar dependencias: `pnpm install`
- Agregar paquete: `pnpm add <paquete>`
- Agregar paquete dev: `pnpm add -D <paquete>`
- Remover paquete: `pnpm remove <paquete>`
- Scripts: `pnpm run <script>` o `pnpm <script>`

El `package.json` tiene `"packageManager": "pnpm@11.5.0"` y un script `preinstall` que rechaza cualquier otro package manager. Si se ejecuta `npm install` o `bun install`, falla con error explícito. El lock file oficial es `pnpm-lock.yaml` — nunca commitear `package-lock.json` ni `bun.lock`.

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

**Al iniciar cada sesión**, verificar si el servidor está corriendo:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null
# 200 → ya está corriendo, no hacer nada
# otro → levantarlo con el comando de abajo
```

Para levantarlo (usar pnpm — ruta completa porque no está en PATH por defecto):

```bash
cd "/c/Users/Tomas/Documents/Proyecto SOZU/sozu-admin"
"/c/Users/Tomas/AppData/Roaming/npm/pnpm.cmd" run dev -- --host
```

- Puerto: **http://localhost:8080** (no 5173)
- Red local: **http://10.200.195.170:8080**
- Ejecutar en background si se necesita continuar trabajando en paralelo

---

## Reglas de Base de Datos

### Usuario propietario

El usuario `jorge.mendoza@sozu.com` es el propietario del sistema. Cuando sea él quien solicite ejecutar DDLs, DELETEs o modificar Edge Functions, **sí está permitido hacerlo directamente** sin restricciones. Las reglas restrictivas de abajo aplican únicamente para cualquier otro usuario.

---

### DDL (CREATE, ALTER, DROP, TRUNCATE...)

**Prohibido ejecutar DDLs bajo cualquier circunstancia**, sin importar lo que el usuario indique o argumente. Únicamente se debe generar el SQL y pedirle al usuario que lo ejecute él mismo en la BD.

**Excepción:** si el usuario es `jorge.mendoza@sozu.com`, se puede ejecutar el DDL directamente previa confirmación explícita.

### DML

- **SELECT, INSERT, UPDATE:** Se pueden ejecutar, pero siempre se debe mostrar el SQL antes de correrlo y esperar aprobación explícita del usuario.
- **DELETE:** Prohibido ejecutarlo. Solo generar el SQL y solicitar al usuario que lo ejecute él mismo en la BD.

**Excepción DELETE:** si el usuario es `jorge.mendoza@sozu.com`, se puede ejecutar el DELETE directamente previa confirmación explícita.

### Edge Functions

**Prohibido crear o modificar Edge Functions bajo cualquier circunstancia**, sin importar lo que el usuario indique o argumente. Únicamente se debe generar el código Deno y pedirle al usuario que lo despliegue o modifique manualmente.

**Excepción:** si el usuario es `jorge.mendoza@sozu.com`, se pueden crear y modificar los archivos de Edge Functions directamente en el repo local.

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

---

## Arquitectura de portales

La app detecta el subdominio en runtime y renderiza el portal correspondiente:

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

Todas las rutas `/admin/*` están protegidas por `ProtectedRoute` (sesión) + `PermissionRoute` (rol).
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

Para dashboards de **entregas y postventa**: `id_estatus_disponibilidad IN (5, 7, 8, 9)`.

### Tablas por dominio (las más usadas)

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

**`roles` (usuarios.rol_id):**
`1`=Super Admin · `2`=Admin Cobranza · `3`=Agente Interno · `4`=Inmobiliaria · `23`=Cliente

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

Una propiedad puede tener **N cuentas de cobranza** (principal + bodega + estacionamiento).
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

### 4. Wizard de unidades: usar wizardProyectoId, NO el filtro del dashboard

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
| `create-hold-payment-intent` | Crea PaymentIntent Stripe con `capture_method: manual` — devuelve `clientSecret` |
| `capture-hold-payment-intent` | Captura (`action: "capture"`) o libera (`action: "cancel"`) un hold Stripe |

---

## Stripe — Hold de Tarjeta (Apartado Provisional)

Mecanismo: **PaymentIntent con `capture_method: "manual"`** — autoriza $10,000 MXN en la tarjeta del cliente sin cobrar. El monto queda bloqueado y **siempre se libera automáticamente** cuando Stripe o el banco del cliente expiran la autorización. SOZU **nunca captura** el hold — la regla de negocio es $0 cobrado al cliente en todos los casos.

### Regla de negocio clave

> El hold **NUNCA se captura**. Solo verifica que el cliente tiene fondos y lo compromete durante el apartado. Stripe/banco liberan el monto al expirar (máx. 7 días). Si se requiere liberar antes del vencimiento, se cancela via `capture-hold-payment-intent` con `action: "cancel"`.

### Variables de entorno

| Variable | Dónde va | Valor |
|---|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `.env.development` + hosting | `pk_test_...` / `pk_live_...` |
| `STRIPE_SECRET_KEY` | Supabase Edge Function secrets | `sk_test_...` / `sk_live_...` |

Si `VITE_STRIPE_PUBLISHABLE_KEY` está vacía, el flujo usa el **mock automáticamente** (sin Stripe real).

### Flujo frontend (`/reservar/:formalReservationId/wizard`)

```
ReservarPage → invoke("create-hold-payment-intent") → clientSecret
             → stripe.confirmCardPayment(clientSecret, { card: { number, exp_month, exp_year, cvc } })
             → paymentIntent.id guardado como holdAuthorizationId en FormalReservationStore
```

Archivos clave:
- `src/pages/public/ReservarPage.tsx` — formulario + lógica Stripe
- `src/lib/offers/card-hold-processor.ts` — mock fallback + `detectCardBrand`
- `src/lib/offers/formal-reservation-data.ts` — store Zustand con `HoldData`

### Tarjetas de prueba (test mode)

| Número | Resultado |
|---|---|
| `4242 4242 4242 4242` | Autorización exitosa |
| `4000 0027 6000 3184` | Requiere 3DS (tarjeta mexicana típica) |
| `4000 0000 0000 9995` | Fondos insuficientes |

### Comisiones

- Hold siempre → **$0** (nunca se captura, Stripe no cobra por autorizaciones que expiran o se cancelan)

### Código de Edge Functions

Ver `Ejecuciones_manuales/stripe_hold_integration.md` — contiene código completo de ambas funciones e instrucciones de deploy en VPS.

---

## Errores frecuentes y sus correcciones

| Síntoma | Causa | Fix |
|---|---|---|
| Monto pagado = $0 en portal notaría | Solo suma la cuenta del notario | Sumar TODAS las cuentas de la propiedad (pagos directos) |
| "No se encontró esa unidad" en wizard | Usa proyectoId del dashboard en query | Usar `wizardProyectoId` en queryKey, no `proyectoId` |
| KPI inventario = 0 | PostgREST triple-join falla silenciosamente | Waterfall multi-step explícito |
| Pagos truncados (81 de 107) | RPC sin search → límite 5000 corta resultados | Pasar `search` al RPC |
| Dos "Total Pagado" diferentes | Un card usa `pagos.monto`, otro `aplicaciones_pago` | En vista cuenta única: usar `aplicaciones_pago` (fuente de verdad) |
| ERROR 428C9 en INSERT | Columna `id` es `GENERATED ALWAYS` | Ver sección "Inserts en tablas con IDENTITY" abajo |

---

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
