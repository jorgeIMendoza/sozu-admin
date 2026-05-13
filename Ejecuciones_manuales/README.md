# Multi-rol — Setup manual (índice)

Orden de ejecución:

1. **[`01_creacion_tablas_y_updates.md`](./01_creacion_tablas_y_updates.md)** — DDL de `user_roles`, trigger de normalización, RLS, helper `user_has_role` y backfill desde `usuarios`. Ejecutar en dev y prod.
2. **[`02_dml_caso_luis_munoz.md`](./02_dml_caso_luis_munoz.md)** — DML puntual para dejar a `luis.munoz@investimento.mx` con roles 3 (Agente) y 23 (Cliente).
3. **[`03_edgefunction_create_client_user.md`](./03_edgefunction_create_client_user.md)** — Código actualizado de la edge function `create-client-user` con flujo de confirmación multi-rol (HTTP 409 / `confirmAddRole`). Deploy manual.

## Frontend

Ya aplicado en `src/pages/admin/UsuariosClientes.tsx`: cuando la EF responde `409 / role_conflict`, se acumulan los conflictos y se muestra un modal donde puedes confirmar uno por uno o todos.

## Convención

Cada acción externa (DDL/DML/función BD/edge function/etc.) vive en su propio archivo dentro de esta carpeta, numerado por orden de ejecución.
