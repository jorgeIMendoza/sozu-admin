

## Plan: Usar Template de Postmark con variables dinámicas

### Problema Actual
La edge function `enviar-aviso-bulk` envía correos usando `HtmlBody` directo con el endpoint `/email/batch`. No usa templates de Postmark, por lo que los placeholders no se reemplazan.

### Cambios Requeridos

**Archivo: `supabase/functions/enviar-aviso-bulk/index.ts`**

1. **Cambiar el endpoint de Postmark** de `/email/batch` a `/email/batchWithTemplates`
2. **Usar el TemplateId `36978552`** en lugar de enviar HTML directo
3. **Construir el TemplateModel** con la estructura requerida por cada destinatario:
   ```json
   {
     "mensaje": {
       "nombre": "Nombre del destinatario",
       "texto": "<strong>El mensaje HTML del aviso</strong>",
       "asunto": "Asunto del mensaje"
     }
   }
   ```
4. **Mapear los datos del destinatario**: El campo `nombre` se tomara del array de destinatarios en `correos` JSONB (cada entrada ya tiene `nombre` y `email`)
5. **El campo `texto`** sera el `mensaje_html` del aviso
6. **El campo `asunto`** sera el `asunto` del aviso

### Cambio clave en el codigo

Antes (actual):
```javascript
const messages = batch.map(email => ({
  From: 'notificaciones@sozu.mx',
  To: email,
  Subject: aviso.asunto,
  HtmlBody: aviso.mensaje_html,
  MessageStream: 'outbound',
}));
// POST a /email/batch
```

Despues (propuesto):
```javascript
const messages = batch.map(recipient => ({
  From: 'notificaciones@sozu.mx',
  To: recipient.email,
  TemplateId: 36978552,
  TemplateModel: {
    mensaje: {
      nombre: recipient.nombre || '',
      texto: aviso.mensaje_html,
      asunto: aviso.asunto,
    },
  },
  MessageStream: 'outbound',
}));
// POST a /email/batchWithTemplates
```

### Ajuste en la recoleccion de destinatarios

Actualmente solo se guardan los emails en un array de strings. Se cambiara para guardar objetos `{ nombre, email }` para poder pasar el nombre al template:

```javascript
// Antes: emails: string[]
// Despues: recipients: { nombre: string; email: string }[]
```

La deduplicacion seguira siendo por email, pero se conservara el nombre asociado.

### Resumen de cambios
- **1 archivo modificado**: `supabase/functions/enviar-aviso-bulk/index.ts`
  - Recolectar recipients como objetos `{nombre, email}` en lugar de solo strings
  - Cambiar endpoint a `/email/batchWithTemplates`
  - Usar `TemplateId: 36978552` con el `TemplateModel` especificado
  - Eliminar `Subject` y `HtmlBody` del mensaje (el template los maneja)
