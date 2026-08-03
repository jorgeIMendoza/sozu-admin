# Unificación de documentos obligatorios del expediente — pendientes y preguntas por portal

No ejecutable: no hay DDL. Es el registro del criterio acordado, de lo que ya quedó
aplicado y de lo que falta preguntar a cada dueño de portal.

## Objetivo

Que **todas** las pantallas usen la misma definición de "documentos obligatorios del
expediente": la lista del **perfil de cliente**, distinguiendo persona física de moral, y
contando siempre **el documento más reciente de cada categoría**.

## Criterio acordado (Eduardo, 2026-07-30)

1. **La lista canónica es la del perfil de cliente.** Es lo que el cliente ve y sube.
2. **Fusión de obligatoriedad:** si un portal exige un documento como obligatorio, el
   cliente también lo sube como obligatorio. El `required` del perfil es la **unión** de lo
   que exija cualquier portal.
3. **Cada portal valida solo su subconjunto.** Un portal puede no exigir un documento que
   el cliente sí subió; simplemente no lo cuenta para su validación.
4. **Persona moral = 9 obligatorios:** empresa (acta constitutiva, registro público de
   comercio, CSF, domicilio fiscal) + representante legal (poder notarial, identificación,
   CURP, CSF, domicilio).
5. Siempre gana el documento **más reciente** de la categoría: si el más nuevo no está
   validado, el grupo no cuenta, aunque exista una versión anterior validada.

## Auditoría — el problema que se corrige

Había **cinco** implementaciones y cuatro definiciones distintas de "los obligatorios":

| Archivo | Definición | Distingue PF/PM |
|---|---|---|
| `src/utils/expediente-grupos.ts` | 5 grupos (CSF, domicilio, INE, CURP, acta) | no |
| `src/hooks/useUnidadesListasEscriturar.ts` | copia propia de los 5 | no |
| `src/pages/admin/legal-flow/EscrituracionExpedientes.tsx` | copia propia de los 5 | no |
| `src/pages/admin/portal-socio-bancario/SocioBancarioExpedientesPage.tsx` | copia propia de los 5 | no |
| `src/hooks/useNotariaExpediente.ts` | usa `expediente-grupos.ts` | no |

Consecuencias medidas en prod (Bottura, 2026-07-30):

- A las personas físicas se les exigía **acta de nacimiento**, que el perfil de cliente
  marcaba `required: false`: el cliente no la subía y el expediente lo penalizaba.
  Impacto: **3 cuentas** de 484 pasan a listas al alinear el criterio.
- A las personas morales se les pedían **CURP y acta de nacimiento** — imposible para una
  empresa. Las **13 cuentas** con comprador moral salían **0 % listas**.

## Lo aplicado (PR del 2026-07-30)

- **Nuevo módulo único:** `src/utils/expediente-obligatorios.ts` — grupos PF/PM, owner
  `self`/`rep`, campo `portales` por grupo, `buildLatestPorPersonaTipo`, `evaluarPersona`,
  `evaluarCuenta`.
- **Aplicado en:** portal de escrituración → `ExpedientesDashboard.tsx`.
- **Perfil de cliente:** acta de nacimiento pasa a obligatoria (regla de fusión: la exige
  escrituración).

## Pendientes — un dueño por portal

Cada uno sigue con su copia vieja de los 5 grupos. Hay que migrarlos al módulo único y,
antes, confirmar con el dueño **qué subconjunto exige ese portal**.

| # | Portal / archivo | Pregunta al dueño | Riesgo si no se migra |
|---|---|---|---|
| 1 | **Jurídico** — `legal-flow/EscrituracionExpedientes.tsx` | ¿Exige acta de nacimiento? ¿Los 9 de PM o solo los 4 de la empresa? | Sigue mostrando PM en 0 % y penalizando PF por el acta |
| 2 | **Socio bancario** — `portal-socio-bancario/SocioBancarioExpedientesPage.tsx` | El banco suele pedir comprobante de ingresos y estado de cuenta: ¿entran como obligatorios? ¿el acta le sirve de algo? | Mismo problema, y quizá le falten documentos que sí necesita |
| 3 | **Notaría** — `hooks/useNotariaExpediente.ts` | La notaría suele exigir acta de matrimonio y régimen conyugal: ¿obligatorios? ¿PM con poder notarial vigente? | PM nunca aparece lista para la notaría |
| 4 | **Unidades p/escriturar** — `hooks/useUnidadesListasEscriturar.ts` | Usa los 5 grupos para el semáforo de "listas": ¿debe seguir el criterio de escrituración? | El semáforo no coincide con el dashboard de expedientes del mismo portal |
| 5 | **App jurídico** — `portal-escrituracion/AppJuridicoDashboard.tsx` | Un comentario dice que replica el criterio de `EscrituracionExpedientes`: confirmar que siga al mismo dueño que (1) | Divergencia silenciosa |

Sugerencia de orden: 4 y 5 primero (mismo portal, mismo dueño que lo ya aplicado), luego 1,
y al final 2 y 3, que probablemente amplíen la lista con documentos nuevos.

## Inventario completo del proyecto — 2026-07-31

Barrido de todo `src/`: **105 archivos** tocan la tabla `documentos` y **51** evalúan
`id_estatus_verificacion`. La mayoría son de otros dominios (multimedia de proyectos,
facturas, contratos, CEPs, evidencias de entrega) y **no** entran aquí. Los que sí muestran o
validan el **expediente del cliente** son estos:

### A. Muestran documentos del cliente

| Portal / pantalla | Archivo | Qué hace hoy |
|---|---|---|
| **CC — admin panel y portal de cobranza** | `components/admin/CuentaDocumentosExpediente.tsx` | Lista **todos** los documentos personales del comprador, sin filtrar obligatorios, sin distinguir PF/PM y **sin quedarse con el más reciente**. Badge de estatus propio. Es el residuo más visible. |
| Jurídico | `components/admin/legal-flow/ExpedienteDocumentos.tsx` · `legal-flow/CompradorDetalleSheet.tsx` | Lista propia + badge propio |
| Socio bancario | `components/admin/portal-socio-bancario/ExpedienteDocumentos.tsx` · su `CompradorDetalleSheet.tsx` | Copia de la de jurídico |
| Portal cliente | `pages/admin/portal-cliente/ClientePerfil.tsx` · `lib/portal-cliente/use-documents.ts` · `portal-cliente/documents/DocumentDetailSheet.tsx` | **Fuente canónica** de la lista PF/PM (slots con `required`) |
| Genéricos del panel | `components/admin/DocumentsTab.tsx` · `DocumentVerification.tsx` · `DocumentHistoryDialog.tsx` | Cada uno con su propio criterio de estatus |

### B. Calculan si el expediente está completo

| Portal | Archivo | Estado |
|---|---|---|
| Escrituración — expedientes | `portal-escrituracion/ExpedientesDashboard.tsx` | ✅ migrado al módulo único |
| Escrituración — unidades p/escriturar | `hooks/useUnidadesListasEscriturar.ts` | copia propia de los 5 grupos |
| Jurídico | `legal-flow/EscrituracionExpedientes.tsx` · `portal-escrituracion/AppJuridicoDashboard.tsx` | copia propia |
| Socio bancario | `portal-socio-bancario/SocioBancarioExpedientesPage.tsx` | copia propia |
| Notaría | `hooks/useNotariaExpediente.ts` | usa `expediente-grupos.ts` (los 5, sin PF/PM) |
| Compradores (transversal) | `hooks/useCompradoresFullDetail.ts` · `hooks/useExpedienteDocs.ts` · `hooks/useExpedienteVentaDetalle.ts` | criterios propios |

### C. Expedientes de OTROS actores — ojo, no son el del cliente

No hay que meterlos en la misma lista de obligatorios, pero sí deberían compartir el
componente visual y el badge:

| Actor | Archivo | Nota |
|---|---|---|
| Agentes | `components/admin/AgentOnboardingStepDialog.tsx` · `hooks/useAgentOnboardingStatus.ts` · `agent-portal/AgentPerfil.tsx` | Define sus propios `INE_DOC_TYPES` y `PASAPORTE_DOC_TYPE = 4` |
| Embajadores | `hooks/useEmbajadorDocumentos.ts` | Lista propia |
| Inmobiliarias | `hooks/useInmobiliariaDataStatus.ts` | Lista propia |

## Arquitectura acordada — lógica pura + un componente visual

1. **Lógica pura, sin React:** `src/utils/expediente-obligatorios.ts`. Grupos por tipo de
   persona, `owner: self|rep`, `portales` por grupo, "más reciente por categoría",
   `evaluarPersona` / `evaluarCuenta` y `fetchDocsObligatorios` (con chunks y `limit`
   explícito, para que PostgREST no corte en silencio).
2. **Componente visual único (shadcn):**
   `src/components/admin/expediente/DocumentosObligatorios.tsx`. Usa Card/Badge/Progress/
   Collapsible del kit del proyecto. Muestra un bloque por comprador con su avance
   (`4/5`, `7/9`), el documento vigente de cada grupo, el aviso de representante legal
   faltante, y el **histórico colapsado marcado como "no cuenta para la validación"**.
   Exporta además `EstatusDocBadge`, que debe reemplazar a los 5 badges distintos que hay
   hoy.
3. **Ningún archivo vuelve a declarar tipos de documento ni grupos.** Si una pantalla
   necesita un subconjunto distinto, se expresa con el campo `portales` del grupo, no con
   una copia local.

### Orden de migración al componente

| # | Dónde | Por qué en ese orden |
|---|---|---|
| 1 | `CuentaDocumentosExpediente.tsx` (CC: admin panel + cobranza) | Es el que más se usa y el que hoy muestra el histórico completo como si todo contara. Se agrega arriba la sección de obligatorios y el listado actual queda como histórico. |
| 2 | `useUnidadesListasEscriturar.ts` + `AppJuridicoDashboard.tsx` | Mismo portal ya migrado; cierra la incoherencia interna de escrituración |
| 3 | Jurídico (`EscrituracionExpedientes.tsx` + su `ExpedienteDocumentos`) | Necesita respuesta del dueño sobre acta y PM |
| 4 | Socio bancario | Probablemente amplía la lista (ingresos, estado de cuenta) |
| 5 | Notaría | Probablemente amplía la lista (matrimonio, régimen conyugal) |
| 6 | Agentes, embajadores, inmobiliarias | Comparten componente y badge, con su propia lista de grupos |

**Estado al 2026-07-31:** hechos los puntos de arquitectura 1 y 2 (lógica + componente) y la
migración de `ExpedientesDashboard`. Los 6 pasos de migración siguen pendientes.

## Datos que faltan, no código

**2 de las 3 personas morales de Bottura no tienen representante legal ligado**
(`personas.id_entidad_relacionada_rep_leg` en `NULL`):

- Inmobiliaria Khm Srl De Cv
- DZOG CAPITAL

Con la regla de los 9, esas cuentas **no pueden completarse** hasta que se les asocie el
representante. El dashboard ya lo dice explícitamente en vez de mostrar un 0/9 sin
explicación, pero alguien tiene que capturar el dato.

```sql
-- Inventario para revisar: personas morales compradoras sin representante legal
SELECT DISTINCT p.id, p.nombre_legal, p.rfc
FROM compradores c
JOIN personas p ON p.id = c.id_persona
WHERE c.activo AND lower(p.tipo_persona) = 'pm'
  AND p.id_entidad_relacionada_rep_leg IS NULL
ORDER BY p.nombre_legal;
```

## Resultado esperado tras migrar cada portal

- Ninguna pantalla define sus propios grupos: todas importan de
  `src/utils/expediente-obligatorios.ts`.
- El total de obligatorios deja de ser fijo (5) y depende del tipo de persona: 5 para PF,
  9 para PM.
- Un mismo expediente da el mismo resultado en todos los portales que exijan el mismo
  subconjunto; donde difiera, es porque el `portales` del grupo lo dice, no por accidente.
