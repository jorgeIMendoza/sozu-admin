
## Correccion: Boton "Aprobar" habilitado para comisionistas externos en Aprobacion de Comisiones

### Problema
En la vista "Aprobacion de Comisiones", el comisionista externo VIVALTA (contacto@vivaltainmobiliaria.com) muestra el boton "Aprobar" habilitado en lugar de mostrar "Ver en Comisiones Externas". 

La causa raiz esta en la logica de deteccion de comisionistas externos (linea 289 de `AprobacionComisiones.tsx`):

```text
const esAgenteExterno = emailsInmobiliarias.has(email) || emailsAgentesInmobiliarios.has(email);
```

- `emailsAgentesInmobiliarios` solo incluye usuarios con `rol_id = 3` (Agente Inmobiliario)
- `emailsInmobiliarias` solo incluye personas encontradas en la tabla `personas` con `tipo_persona = 'pm'` que NO existen en la tabla `usuarios`

VIVALTA tiene `rol_id = 4` (Inmobiliaria) en la tabla `usuarios`, por lo que:
1. Se encuentra en `usuarios` y no llega al fallback de `personas`
2. Su `rol_id` es 4, no 3, asi que no entra en `emailsAgentesInmobiliarios`
3. Resultado: `esExterno = false`, y el boton "Aprobar" se muestra habilitado

### Solucion
Modificar la deteccion de comisionistas externos para incluir tambien `rol_id = 4` (Inmobiliaria) ademas de `rol_id = 3` (Agente Inmobiliario).

### Cambios

**Archivo: `src/pages/admin/AprobacionComisiones.tsx`**

1. Renombrar `emailsAgentesInmobiliarios` a `emailsExternos` y ampliar el filtro para incluir `rol_id = 3` (Agente Inmobiliario) y `rol_id = 4` (Inmobiliaria):

```text
// Antes (linea 230):
const emailsAgentesInmobiliarios = new Set(
  usuariosData?.filter(u => u.rol_id === 3).map(u => u.email) || []
);

// Despues:
const emailsExternos = new Set(
  usuariosData?.filter(u => u.rol_id === 3 || u.rol_id === 4).map(u => u.email) || []
);
```

2. Actualizar la referencia en la linea 289 y las propiedades del comisionista:

```text
// Antes:
const esAgenteExterno = emailsInmobiliarias.has(c.email_usuario) || emailsAgentesInmobiliarios.has(c.email_usuario);

// Despues:
const esAgenteExterno = emailsInmobiliarias.has(c.email_usuario) || emailsExternos.has(c.email_usuario);
```

3. Actualizar la propiedad `esAgenteInmobiliario` para incluir rol 4:

```text
// Antes (linea 239):
esAgenteInmobiliario: u.rol_id === 3

// Despues:
esAgenteInmobiliario: u.rol_id === 3 || u.rol_id === 4
```

### Resultado esperado
- VIVALTA y cualquier usuario con rol Inmobiliaria (4) o Agente Inmobiliario (3) mostrara "Ver en Comisiones Externas" en lugar del boton "Aprobar"
- El boton "Aprobar Todos (Internos)" seguira excluyendo a estos comisionistas externos
- Las comisiones externas solo se aprueban desde la vista "Comisiones Externas"
