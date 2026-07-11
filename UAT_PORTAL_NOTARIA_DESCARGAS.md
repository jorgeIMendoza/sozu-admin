# UAT — Portal Notaría SOZU: Descarga de Expedientes y Comprobantes de Pago

| Campo | Valor |
|---|---|
| Proyecto | sozu-admin |
| Rama | `cambios_tomas` |
| Fecha preparación | 2026-07-10 |
| Preparado por | Claude Code |
| Ejecutado por | _(nombre del tester)_ |
| Fecha ejecución | _(fecha)_ |
| Ambiente | Dev — http://localhost:8080 |

---

## Datos de referencia para los casos de prueba

| Cuenta | Notario ID | Descripción | Usar en |
|---|---|---|---|
| CC-000235 | 152 | 1 comprador, expediente 5/5 completo, bodega CC-000754 | UAT 3, 6 |
| CC-000518 | 43 | 2 compradores (copropiedad), expediente 3/5 por comprador | UAT 4, 5 |
| CC-000478 | 308 | 1 comprador, estacionamiento CC-000808 | UAT 7 |
| CC-000235 (pago 6226) | 152 | Pago con CEP (api.sozu.com) + recibo (supabase.co) | UAT 8 |

> Los eventos de auditoría se registran en la tabla `app_notaria_actividad`.
> Query de verificación: `SELECT * FROM app_notaria_actividad ORDER BY id DESC LIMIT 10;`

---

## UAT 1 — Usuario Notaría

**Precondición:** Usuario con `id_notario` asignado (ej. notario ID 152, asociado a CC-000235).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Iniciar sesión con usuario Notaría | Acceso exitoso al portal `/admin/portal-notaria/inicio` | |
| 2 | Observar la tabla de unidades | Solo aparecen las unidades asignadas al notario autenticado | |
| 3 | Verificar que no aparecen otras unidades | No hay filas de otras notarías | |
| 4 | Hacer clic en el botón de expediente (ícono carpeta) de cualquier fila | Se abre el modal de expediente; la página NO navega a `/admin/portal-escrituracion/expedientes` | |
| 5 | Confirmar ausencia de navegación | La URL sigue siendo `/admin/portal-notaria/inicio` | |
| 6 | Cerrar modal. Hacer clic en el botón de recibo (ícono Receipt) | Se abre el modal de comprobantes de pago; la página NO navega a `/admin/portal-notaria/relacion-pagos` | |
| 7 | Confirmar ausencia de navegación | La URL sigue siendo `/admin/portal-notaria/inicio` | |
| 8 | Seleccionar una fila. En el panel derecho, clic en "Descargar rel. pagos" | Se abre el modal de comprobantes (no navega) | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 2 — Usuario Administrador

**Precondición:** Usuario con rol 1 (Super Admin).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Iniciar sesión con usuario Administrador | Acceso exitoso al portal `/admin/portal-notaria/inicio` | |
| 2 | Verificar presencia del selector de notaría | Aparece dropdown con lista de notarías | |
| 3 | Seleccionar notaría del notario 152 | La tabla muestra las unidades asignadas al notario 152 (debe aparecer CC-000235) | |
| 4 | Cambiar a otra notaría en el dropdown | La tabla se actualiza mostrando las unidades de la nueva notaría seleccionada | |
| 5 | Seleccionar CC-000235 y ejecutar una descarga de expediente | El ZIP se genera correctamente con los documentos del notario 152 | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 3 — Expediente Completo

**Precondición:** Usuario con acceso a CC-000235 (notario 152). Esta cuenta tiene 5/5 grupos documentales validados para el comprador (persona 1224).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Abrir modal de expediente para CC-000235 | Modal abierto. Badge muestra "5/5 documentos" | |
| 2 | Verificar texto del botón | Botón habilitado con texto "Descargar expediente completo" | |
| 3 | Hacer clic en el botón | Se inicia la generación del ZIP; barra de progreso visible | |
| 4 | Verificar el ZIP descargado | Archivo `EXPEDIENTE_[PROYECTO]_[UNIDAD]_CC-000235.zip` en carpeta de descargas | |
| 5 | Abrir el ZIP. Verificar 5 documentos | Carpeta `01_[NOMBRE_COMPRADOR]` con archivos: `csf_...`, `domicilio_...`, `ine_...`, `curp_...`, `acta_...` | |
| 6 | Verificar RESUMEN_EXPEDIENTE.txt | Archivo presente en la raíz del ZIP; indica 5/5 completo | |
| 7 | Verificar evento de auditoría en BD | `SELECT * FROM app_notaria_actividad ORDER BY id DESC LIMIT 3` → fila con `evento = 'EXPEDIENTE_DOWNLOAD_COMPLETO'` | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 4 — Expediente Parcial

**Precondición:** Usuario con acceso a CC-000518 (notario 43). Esta cuenta tiene 3/5 grupos documentales por comprador (faltan Acta de nacimiento y Domicilio).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Abrir modal de expediente para CC-000518 | Modal abierto. Badge muestra estado parcial | |
| 2 | Verificar alerta ámbar | Aparece advertencia indicando documentos faltantes | |
| 3 | Verificar texto del botón | Botón habilitado con texto "Descargar documentos disponibles" | |
| 4 | Hacer clic en el botón | Se genera el ZIP con los documentos disponibles | |
| 5 | Verificar documentos en el ZIP | Solo los 3 grupos validados por comprador; los 2 faltantes ausentes | |
| 6 | Verificar RESUMEN_EXPEDIENTE.txt | Indica documentos faltantes (ej. `✗ acta`, `✗ domicilio`) | |
| 7 | Verificar evento de auditoría | `evento = 'EXPEDIENTE_DOWNLOAD_PARCIAL'` | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 5 — Copropiedad

**Precondición:** Usuario con acceso a CC-000518 (2 compradores activos: personas 2158 y 1341).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Abrir modal de expediente para CC-000518 | Modal muestra sección de dos compradores | |
| 2 | Verificar que aparecen ambos compradores | Dos filas de compradores en el modal | |
| 3 | Ejecutar la descarga | ZIP generado | |
| 4 | Verificar estructura del ZIP | Dos carpetas: `01_[NOMBRE_PERSONA_2158]` y `02_[NOMBRE_PERSONA_1341]` | |
| 5 | Verificar documentos en cada carpeta | Cada carpeta contiene los documentos del comprador correspondiente (no mezclados) | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 6 — Bodega

**Precondición:** Usuario con acceso a CC-000235 (propiedad 5034 tiene bodega asociada, cuenta CC-000754).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Abrir modal de comprobantes de pago para CC-000235 | Modal muestra tabla con al menos dos filas: "Unidad principal CC-000235" y "Bodega CC-000754" | |
| 2 | Verificar conteo de pagos por cuenta | Columnas "Pagos", "Con comprobante", "Sin comprobante" muestran valores por cuenta | |
| 3 | Ejecutar descarga | ZIP generado | |
| 4 | Verificar estructura del ZIP | Carpeta `01_UNIDAD_PRINCIPAL_CC-000235` y carpeta `02_BODEGA_CC-000754` | |
| 5 | Verificar pagos en carpeta de bodega | Comprobantes de CC-000754 en su carpeta correspondiente | |
| 6 | Verificar RESUMEN_PAGOS.txt | Archivo presente; sección "CUENTAS ESCRITURABLES" lista ambas cuentas; nota de operación única de escrituración | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 7 — Estacionamiento

**Precondición:** Usuario con acceso a CC-000478 (propiedad 4982 tiene estacionamiento asociado, cuenta CC-000808).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Abrir modal de comprobantes de pago para CC-000478 | Modal muestra tabla con "Unidad principal CC-000478" y "Estacionamiento CC-000808" | |
| 2 | Ejecutar descarga | ZIP generado | |
| 3 | Verificar estructura del ZIP | Carpeta `01_UNIDAD_PRINCIPAL_CC-000478` y carpeta `02_ESTACIONAMIENTO_CC-000808` | |
| 4 | Verificar pagos en carpeta de estacionamiento | Comprobantes de CC-000808 en su carpeta | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 8 — CEP + Recibo

**Precondición:** Usuario con acceso a CC-000235. El pago ID 6226 de esta cuenta tiene tanto `url_cep` (api.sozu.com) como `url_recibo` (supabase.co).

| # | Paso | Resultado esperado | ✓ / ✗ |
|---|---|---|---|
| 1 | Abrir modal de comprobantes para CC-000235 y ejecutar descarga | ZIP generado | |
| 2 | Localizar el pago 6226 dentro de la carpeta `01_UNIDAD_PRINCIPAL_CC-000235` | Deben existir **dos archivos** para ese pago | |
| 3 | Verificar nombre del archivo CEP | `pago_XX_[METODO]_[FECHA]_[MONTO]_cep.pdf` | |
| 4 | Verificar nombre del archivo recibo | `pago_XX_[METODO]_[FECHA]_[MONTO]_recibo.pdf` | |
| 5 | Abrir ambos archivos | Ambos PDFs se abren correctamente y corresponden a comprobantes distintos | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## UAT 9 — Auditoría

**Precondición:** Haber ejecutado al menos una descarga de expediente (completo o parcial) y una descarga de pagos. Acceso a BD de desarrollo para ejecutar la query de verificación.

Query de verificación:
```sql
SELECT id, id_cuenta_cobranza, evento, usuario_email, created_at
FROM app_notaria_actividad
ORDER BY id DESC
LIMIT 20;
```

| # | Evento | Condición de disparo | Encontrado en BD ✓ / ✗ |
|---|---|---|---|
| 1 | `EXPEDIENTE_VIEWED` | Al abrir el modal de expediente | |
| 2 | `EXPEDIENTE_DOWNLOAD_COMPLETO` | Al descargar expediente 5/5 validados, sin fallos | |
| 3 | `EXPEDIENTE_DOWNLOAD_PARCIAL` | Al descargar expediente con documentos faltantes o fallos | |
| 4 | `PAGOS_DOWNLOAD` | Al ejecutar cualquier descarga de comprobantes de pago | |

**Verificación adicional — columna `detalle` (si existe):**
```sql
SELECT evento, detalle
FROM app_notaria_actividad
WHERE evento IN ('EXPEDIENTE_DOWNLOAD_COMPLETO', 'PAGOS_DOWNLOAD')
ORDER BY id DESC
LIMIT 5;
```
Si la columna `detalle` existe, verificar que contiene metadatos (documentos incluidos, comprobantes descargados, etc.).

**Resultado:** PASS ☐ / FAIL ☐

**Evidencia (pegar resultado de query):**
```
_______________________________________________
_______________________________________________
```

---

## UAT 10 — Regresión

**Precondición:** Ninguna sesión activa con modales abiertos. Navegar desde la raíz del portal para verificar que las secciones no afectadas siguen funcionando.

| # | Módulo | Acción | Resultado esperado | ✓ / ✗ |
|---|---|---|---|---|
| 1 | Portal Expedientes | Navegar a `/admin/portal-escrituracion/expedientes` | Carga correctamente; tabla con unidades | |
| 2 | Portal Expedientes | Abrir detalle de cualquier cuenta | Sheet/modal abre con documentos y bitácora | |
| 3 | Relación de Pagos | Navegar a `/admin/portal-notaria/relacion-pagos` | Tabla de pagos carga correctamente | |
| 4 | PLD | Navegar al módulo PLD | Carga sin errores | |
| 5 | Portal Notaría — Dashboard | Navegar a `/admin/portal-notaria/inicio` | Dashboard carga; tabla de unidades visible | |
| 6 | Dashboard Notarías | Verificar listado de notarías | Datos correctos; sin errores en consola del browser | |
| 7 | Asignación de Notarías | Abrir formulario de asignación | Formulario abre correctamente | |
| 8 | Consola del browser | Revisar DevTools → Console durante toda la sesión | Sin errores de JavaScript no controlados | |

**Resultado:** PASS ☐ / FAIL ☐

**Observaciones:**
```
_______________________________________________
_______________________________________________
```

---

## Tabla Resumen

| Caso | Descripción | PASS | FAIL | Observaciones |
|------|-------------|------|------|---------------|
| UAT 1 | Usuario Notaría | ☐ | ☐ | |
| UAT 2 | Usuario Administrador | ☐ | ☐ | |
| UAT 3 | Expediente completo | ☐ | ☐ | |
| UAT 4 | Expediente parcial | ☐ | ☐ | |
| UAT 5 | Copropiedad | ☐ | ☐ | |
| UAT 6 | Bodega | ☐ | ☐ | |
| UAT 7 | Estacionamiento | ☐ | ☐ | |
| UAT 8 | CEP + Recibo | ☐ | ☐ | |
| UAT 9 | Auditoría | ☐ | ☐ | |
| UAT 10 | Regresión | ☐ | ☐ | |
| **TOTAL** | | | | |

---

## Criterios de aceptación

- **APROBADO:** Los 10 casos en PASS, sin observaciones bloqueantes.
- **APROBADO CON OBSERVACIONES:** Máximo 2 casos con hallazgos menores no bloqueantes; equipo técnico valora antes de liberar.
- **RECHAZADO:** Cualquier caso UAT 1–9 en FAIL por bug funcional; o UAT 10 en FAIL (regresión).

En caso de RECHAZADO, documentar el hallazgo con capturas y pasos para reproducir, y entregar al equipo técnico para corrección antes de re-ejecutar UAT.

---

## Restricciones durante la ejecución

> **No crear usuarios de prueba.**
> **No modificar contraseñas ni desactivar autenticación.**
> **No alterar políticas RLS.**
> **No ejecutar DDL.**
> **Usar exclusivamente credenciales reales del ambiente de desarrollo.**

---

*Documento generado el 2026-07-10. La funcionalidad NO deberá liberarse a Producción sin implementar la política RLS sobre `cuentas_cobranza` propuesta como parte de la Fase de Seguridad posterior a la UAT.*
