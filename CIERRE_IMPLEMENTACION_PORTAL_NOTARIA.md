# CIERRE DE IMPLEMENTACIÓN — Portal Notaría SOZU
## Descarga de Expedientes y Comprobantes de Pago

| Campo | Valor |
|---|---|
| Proyecto | sozu-admin |
| Rama | `cambios_tomas` |
| Commit | `7610405c` |
| Pull Request | [#536](https://github.com/jorgeIMendoza/sozu-admin/pull/536) → `dev` |
| Fecha de cierre | 2026-07-10 |
| Preparado por | Claude Code |

---

## 1. Resumen Ejecutivo

La implementación de las funcionalidades de **Descarga de Expediente** y **Descarga de Comprobantes de Pago** en el Portal Notaría SOZU ha sido completada, validada y entregada para integración a la rama `dev`.

El proyecto atravesó cuatro fases formales:

| Fase | Descripción | Estado |
|---|---|---|
| Fase 1 | Descarga de Expediente (modal, servicio, ZIP) | ✅ Completada |
| Fase 2 | Auditoría y refinamiento de expediente | ✅ Completada |
| Fase 3 | Descarga de Comprobantes de Pago (modal, hook, ZIP) | ✅ Completada |
| Fase 3.5 | Validación técnica integrada (16 escenarios automatizados) | ✅ Completada |
| UAT | Pruebas funcionales con credenciales reales en Preview | ✅ Aprobada |

La UAT fue ejecutada por el equipo funcional en ambiente Preview con usuarios reales (rol Notaría y Super Administrador). Los 10 casos de prueba resultaron en PASS. No se detectaron regresiones en los módulos existentes.

El commit `7610405c` fue integrado a `cambios_tomas` y la rama fue empujada al remoto. El PR #536 está abierto y listo para revisión de código antes del merge a `dev`.

---

## 2. Resultado UAT

UAT ejecutada en ambiente Preview con credenciales reales. Fecha: 2026-07-10.

| Caso | Descripción | PASS | FAIL | Observaciones |
|---|---|---|---|---|
| UAT 1 | Usuario Notaría | ✅ | — | Solo visualiza unidades propias. Modales abren correctamente. Sin navegación a módulos administrativos. |
| UAT 2 | Usuario Administrador | ✅ | — | Selector de notaría funcional. Cambio de notaría actualiza tabla. Descarga correcta. |
| UAT 3 | Expediente completo | ✅ | — | ZIP generado. 5 documentos presentes. RESUMEN_EXPEDIENTE.txt correcto. Auditoría registrada. |
| UAT 4 | Expediente parcial | ✅ | — | Alerta ámbar visible. Botón "Descargar documentos disponibles". Documentos faltantes indicados en RESUMEN. Evento PARCIAL registrado. |
| UAT 5 | Copropiedad | ✅ | — | Dos compradores mostrados en modal. ZIP con dos carpetas separadas. Documentos sin mezcla entre personas. |
| UAT 6 | Bodega | ✅ | — | Modal muestra unidad principal + bodega. ZIP con carpetas `01_UNIDAD_PRINCIPAL` y `02_BODEGA`. RESUMEN_PAGOS indica operación única. |
| UAT 7 | Estacionamiento | ✅ | — | Modal muestra unidad principal + estacionamiento. ZIP con carpeta `02_ESTACIONAMIENTO`. Pagos incluidos. |
| UAT 8 | CEP + Recibo | ✅ | — | Pago con ambas URLs genera dos archivos. Nombres `_cep.pdf` y `_recibo.pdf` correctos. Ambos PDFs accesibles. |
| UAT 9 | Auditoría | ✅ | — | Los 4 eventos registrados en `app_notaria_actividad`: EXPEDIENTE_VIEWED, EXPEDIENTE_DOWNLOAD_COMPLETO, EXPEDIENTE_DOWNLOAD_PARCIAL, PAGOS_DOWNLOAD. |
| UAT 10 | Regresión | ✅ | — | Portal Expedientes, Relación de Pagos, PLD, Dashboard Notarías y Asignación de Notarías funcionan sin modificaciones. Sin errores en consola. |

**Resultado global: 10/10 PASS — Sin fallos.**

---

## 3. Hallazgos

### Bugs

Ninguno. La UAT no detectó defectos funcionales.

### Observaciones (hallazgos técnicos de Fase 3.5 sin impacto en UAT)

| # | Observación | Impacto |
|---|---|---|
| O-1 | No existe propiedad con bodega **y** estacionamiento simultáneos en el ambiente dev. El escenario fue validado por revisión de código; la lógica de ambos waterfalls es independiente y aditiva. | Ninguno — código correcto. |
| O-2 | Las cuentas con `id_notario` asignado no tienen pagos con `url_cep IS NULL AND url_recibo IS NULL` en dev. El Estado B del modal (sin comprobantes disponibles) fue validado por revisión de código. | Ninguno — código correcto. |
| O-3 | No se encontraron URLs duplicadas reales entre cuentas notaría. La lógica `dedupeKey()` fue validada por revisión de código y confirmada como correcta. | Ninguno — código correcto. |
| O-4 | `invalidUrlsCount` será prácticamente siempre 0 en datos reales porque los valores `null` son pre-filtrados como "sin comprobante" antes de llegar a `classifyDocUrl`. El contador es arquitectónicamente correcto pero no tiene caso de disparo con datos actuales. | Ninguno — campo correcto, sin impacto visual. |

### Mejoras futuras

| # | Mejora | Prioridad |
|---|---|---|
| MF-1 | Implementar RLS sobre `cuentas_cobranza` para reemplazar el filtro `id_notario` del hook (actualmente capa MVP) | Alta — bloqueante para Producción |
| MF-2 | Migrar bucket `documentos` de público a privado e implementar Signed URLs | Alta — bloqueante para Producción |
| MF-3 | Añadir paginación al listado de pagos en el modal si el volumen crece significativamente | Baja — no urgente |
| MF-4 | Soporte para descarga de propiedad con bodega **y** estacionamiento simultáneos (validación pendiente con dato real) | Baja — código ya lo soporta, falta dato de prueba |

### Datos faltantes en ambiente dev

| Escenario | Dato faltante |
|---|---|
| Bodega + estacionamiento simultáneos | Ninguna propiedad tiene ambos tipos de oferta activa a la vez |
| Pago sin comprobante en cuenta notaría | Las cuentas con `id_notario` no tienen pagos con `url_cep = null AND url_recibo = null` |
| URL duplicada real | No existen dos pagos con la misma URL en las cuentas notaría del ambiente dev |

---

## 4. Riesgos abiertos

### RLS sobre `cuentas_cobranza` — BLOQUEANTE PARA PRODUCCIÓN

El filtro de seguridad actual (`.eq('id_notario', notarioId)` en hooks) **no es un mecanismo de seguridad**. Es una capa de compatibilidad MVP implementada en el cliente.

> **La funcionalidad NO deberá liberarse a Producción sin implementar la política RLS propuesta.**

Política propuesta:
```sql
-- Pendiente de implementación antes de Producción
CREATE POLICY "notarios_solo_sus_cuentas"
ON cuentas_cobranza
FOR SELECT
USING (
  id_notario = (
    SELECT id_notario FROM usuarios WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE auth_id = auth.uid()
    AND rol_id IN (1, 2)  -- Super Admin, Admin Cobranza
  )
);
```

### Bucket `documentos` público — RIESGO DE EXPOSICIÓN

El bucket `documentos` de Supabase Storage es actualmente público. Cualquier persona con la URL puede acceder a los documentos sin autenticación. Ver deuda técnica para el plan de mitigación.

### Endurecimiento de Storage — PENDIENTE

El sistema de resolución de URLs (`classifyDocUrl`, `resolveDocUrl`) ya contempla rutas privadas y generación de Signed URLs. Sin embargo, hasta que el bucket sea migrado a privado, el beneficio es parcial.

### Riesgos en Producción

| Riesgo | Probabilidad | Severidad | Estado |
|---|---|---|---|
| Notario accede a cuentas de otro notario vía manipulación de parámetros | Media | Alta | Mitigado en DEV con hook; **sin mitigar en Producción sin RLS** |
| URL de comprobante accesible sin autenticación | Alta | Media | Sin mitigar hasta migración de bucket |
| Pago con URL malformada (no nula, no vacía, no URL válida) | Muy baja | Baja | Manejado como `failedFiles` en el ZIP |
| Timeout en generación de ZIP con muchos comprobantes | Baja | Baja | No hay límite configurado; monitorear en producción real |

---

## 5. Deuda técnica

### Endurecimiento de Seguridad de Storage — SOZU

**Descripción:** El sistema de comprobantes descarga archivos desde Supabase Storage a través del cliente (`resolveDocUrl`). El bucket `documentos` es público, lo que expone los archivos sin control de acceso a nivel de infraestructura.

**Alcance del trabajo pendiente:**

1. **Migrar bucket `documentos` a privado** en Supabase Storage (requiere DDL en Storage, no en PostgreSQL).

2. **Implementar Signed URLs** para todos los accesos a documentos privados. El servicio `resolveDocUrl` ya tiene soporte para rutas `private_path` — solo requiere que el bucket esté configurado como privado para que el mecanismo se active correctamente.

3. **Revisar bucket `legacy-uploads`** (Supabase Cloud, `tzmhgfjmddkfyffkkmto.supabase.co`) — actualmente también público. Determinar si aplica la misma migración.

4. **Implementar RLS** sobre `cuentas_cobranza` (ver Sección 4).

5. **Auditoría de acceso a Storage** — evaluar si los logs de descarga en `app_notaria_actividad` son suficientes o si se requiere logging adicional a nivel de Storage.

**Archivos afectados cuando se implemente:**

| Archivo | Cambio requerido |
|---|---|
| `src/services/notaria-download.service.ts` | `resolveDocUrl` ya soporta `private_path` — sin cambios si bucket migra correctamente |
| Supabase Storage config | Migrar bucket `documentos` a `private` |
| BD PostgreSQL | Agregar política RLS sobre `cuentas_cobranza` |

**Prerrequisito para Producción:** Este trabajo debe completarse y validarse en DEV antes de cualquier despliegue a Producción.

---

## 6. Estado del repositorio

### Archivos nuevos (creados en esta implementación)

| Archivo | Descripción |
|---|---|
| `src/services/notaria-download.service.ts` | Servicio principal: ZIP, resolución de URLs, deduplicación, RESUMEN |
| `src/services/notaria-actividad.service.ts` | Auditoría fire-and-forget con fallback de columna |
| `src/hooks/useNotariaExpediente.ts` | Waterfall de documentos obligatorios + descarga de expediente |
| `src/hooks/useNotariaPagos.ts` | Waterfall de cuentas/pagos + descarga de comprobantes |
| `src/components/admin/portal-notaria/NotariaExpedienteModal.tsx` | Modal de expediente (presentación pura) |
| `src/components/admin/portal-notaria/NotariaPagosModal.tsx` | Modal de comprobantes de pago (presentación pura) |
| `src/utils/expediente-grupos.ts` | Utilidad compartida: grupos obligatorios, buildLatestDocByKey, calcCuentaDocStats |
| `UAT_PORTAL_NOTARIA_DESCARGAS.md` | Protocolo de pruebas de aceptación (10 casos) |

### Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/pages/admin/portal-escrituracion/AppNotariaDashboard.tsx` | Reemplaza navegación a `relacion-pagos` y `portal-expedientes` por apertura de modales |
| `src/pages/admin/portal-escrituracion/ExpedientesDashboard.tsx` | Consume `expediente-grupos.ts` en lugar de definir las funciones localmente |
| `src/components/admin/legal-flow/CompradorDetalleSheet.tsx` | Agrega prop `readOnly` para uso en portal notaría sin bitácora de validación |

### Commit

| Campo | Valor |
|---|---|
| Hash | `7610405c` |
| Mensaje | `feat(portal-notaria): implementa descarga de expedientes y comprobantes de pago` |
| Insertions | +2406 |
| Deletions | −162 |
| Archivos | 11 (8 nuevos, 3 modificados) |

### Pull Request

| Campo | Valor |
|---|---|
| Número | #536 |
| URL | https://github.com/jorgeIMendoza/sozu-admin/pull/536 |
| Origen | `cambios_tomas` |
| Destino | `dev` |
| Estado | Abierto — listo para revisión y merge |

### Confirmación de integridad

No se realizaron cambios de código posteriores a la UAT. El commit `7610405c` contiene exactamente los archivos aprobados en la UAT, sin modificaciones adicionales. La rama `cambios_tomas` no tiene commits pendientes de push.

---

## 7. Recomendación

### B) APROBADO PARA PUSH

La implementación cumple con todos los criterios de aceptación:

- UAT ejecutada y aprobada (10/10 PASS).
- TypeScript sin errores.
- Build de producción exitoso.
- Sin regresiones en módulos existentes.
- Sin cambios fuera del alcance aprobado.
- Commit `7610405c` en rama `cambios_tomas` empujado a `origin`.
- PR #536 abierto hacia `dev`.

**Acción pendiente:** Revisión de código del PR #536 y merge a `dev` por parte del equipo técnico.

**Condición para Producción:** Implementar RLS sobre `cuentas_cobranza` y endurecimiento de Storage antes de cualquier despliegue a Producción. Esta condición es obligatoria y no negociable.

---

*Documento generado el 2026-07-10.*
*La funcionalidad NO deberá liberarse a Producción sin implementar la política RLS propuesta y el endurecimiento de Storage documentado en la Sección 5.*
