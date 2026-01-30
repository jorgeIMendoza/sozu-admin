

## Cambio Requerido

Modificar el campo `nombre` en el payload de notificación para que siempre sea "Administrador" en lugar de obtenerlo dinámicamente de los roles.

---

## Cambio Técnico

**Archivo:** `src/pages/admin/Inmobiliarias.tsx`

Cambiar las líneas 432-435:
```typescript
// ANTES:
const rolUsuario = (superAdmins?.[0]?.roles as any)?.nombre || 
                  (adminProyecto?.[0]?.roles as any)?.nombre || 
                  'Administrador';

// DESPUÉS:
const rolUsuario = 'Administrador';
```

---

## Payload Resultante para "tercera prueba"

```json
{
    "tipo": "ambos",
    "from": "Notificaciones Sozu <notificaciones@sozu.com>",
    "email": "abel.salazar@sozu.com,jorge.admin.proy@yopmail.com",
    "cc": "joseramon.escobar@sozu.com,jorge.mendoza@sozu.com,rodrigo.terveen@sozu.com",
    "telefono": "+527225458999,+528899556633",
    "mensajeWA": "Se ha creado la Inmobiliaria *tercera prueba*, con el usuario: *terceraprueba@test.com*",
    "asunto": "Alta de Inmobiliaria",
    "mensaje": {
        "nombre": "Administrador",
        "actividad": "Alta de inmobiliaria",
        "detalles": "<tr><td class='label'>Nombre:</td> <td class='value'>tercera prueba</td> </tr><tr><td class='label'>Usuario:</td><td class='value'>terceraprueba@test.com</td></tr>"
    },
    "templateId": 41353048
}
```

