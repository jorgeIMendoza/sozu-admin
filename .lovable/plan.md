
Objetivo: corregir el correo de aprobación de comisiones externas para que el template reciba el JSON correcto y renderice bien el subject y el mensaje.

1. Ajustar `src/pages/admin/ComisionesExternas.tsx`
- Cambiar el payload que hoy se manda a `enviar-notificacion` con `templateId: 36978552`.
- Ese template no espera `mensaje.actividad` ni `mensaje.detalles`; espera el mismo formato usado en `enviar-aviso-bulk`:
  - `mensaje.nombre`
  - `mensaje.asunto`
  - `mensaje.texto`
- Por eso el correo sale “vacío” en la parte marcada.

2. Construir el mensaje correcto
- Mantener el subject principal como:
  - `Comisión de venta aprobada`
- Enviar el cuerpo en `mensaje.texto` con el texto solicitado, por ejemplo:
  - `La comisión de venta para el departamento Daiku 205 ha sido aprobada, el monto es 227,464.44 + IVA, favor de generar y adjuntar factura en plataforma.`
- Seguir mostrando `+ IVA` también en la UI donde corresponda.

3. Mantener compatibilidad con el helper actual
- Conservar `tipo`, `from`, `email`, `cc`, `templateId`.
- Dejar `asunto` top-level si el edge function lo usa para email/WhatsApp, pero asegurar que el template reciba además `mensaje.asunto` y `mensaje.texto`, que es lo que realmente renderiza.

4. Revisar otros usos incorrectos del mismo template 36978552
- Hay otros envíos con el mismo patrón erróneo (`actividad/detalles`) en:
  - `supabase/functions/generar-factura-comision-sozu/index.ts`
  - `supabase/functions/timbrar-factura-comision-sozu/index.ts`
- Los incluiría en el ajuste para evitar más correos rotos con ese mismo template.

5. Validación esperada
- El correo de comisión aprobada debe mostrar:
  - Subject: `Comisión de venta aprobada`
  - Saludo con nombre
  - Mensaje legible dentro del bloque principal
  - Sin filas HTML vacías
- El contenido debe quedar consistente con cómo hoy funciona `enviar-aviso-bulk`, que ya usa correctamente este template.

Detalles técnicos
- Evidencia encontrada:
  - Uso correcto del template `36978552` en `supabase/functions/enviar-aviso-bulk/index.ts`:
    - `mensaje.nombre`
    - `mensaje.asunto`
    - `mensaje.texto`
  - Uso incorrecto actual en `src/pages/admin/ComisionesExternas.tsx`:
    - `mensaje.nombre`
    - `mensaje.actividad`
    - `mensaje.asunto`
    - `mensaje.detalles`
- Conclusión:
  - Se mezclaron dos contratos de template:
    - `41353048` usa `actividad/detalles`
    - `36978552` usa `asunto/texto`
  - El fix es alinear `ComisionesExternas` y los otros envíos del `36978552` a `texto`, no a `detalles`.
