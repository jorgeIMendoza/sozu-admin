

## Problema Identificado

El código actual en `Inmobiliarias.tsx` línea 423 tiene hardcodeado el código de país para México como `+52`, pero según la base de datos (tabla `paises`), el código correcto para México (MX) es **`+521`**.

```typescript
// Código actual INCORRECTO (línea 423):
const codigoPais = clavePais === 'MX' ? '+52' : clavePais === 'US' || clavePais === 'CA' ? '+1' : `+${clavePais}`;
```

---

## Solución Propuesta

Modificar la función `formatearTelefonos` para consultar la tabla `paises` y obtener el código telefónico correcto (`clave_pais_telefono`) en lugar de usar valores hardcodeados.

### Cambio Técnico

**Archivo:** `src/pages/admin/Inmobiliarias.tsx`

1. **Agregar consulta a la tabla de países** antes del formateo de teléfonos
2. **Usar el código real de la BD** en la función `formatearTelefonos`

```typescript
// Obtener códigos telefónicos de países
const { data: paises } = await supabase
  .from('paises')
  .select('id, clave_pais_telefono')
  .eq('activo', true);

const codigosPorPais = new Map(
  (paises || []).map(p => [p.id.trim(), p.clave_pais_telefono?.trim()])
);

// Helper para formatear teléfonos con código de país desde BD
const formatearTelefonos = (usuarios: any[]) => {
  return (usuarios || [])
    .filter(u => u.telefono)
    .map(u => {
      const clavePais = (u.clave_pais_telefono || 'MX').trim();
      const codigoPais = codigosPorPais.get(clavePais) || '+52';
      return `${codigoPais}${u.telefono}`;
    })
    .join(',');
};
```

---

## Payload Corregido para "tercera prueba"

Con esta corrección, el teléfono usará **+521** (de la BD) en lugar de +52:

```json
{
    "tipo": "ambos",
    "from": "Notificaciones Sozu <notificaciones@sozu.com>",
    "email": "abel.salazar@sozu.com,jorge.admin.proy@yopmail.com",
    "cc": "joseramon.escobar@sozu.com,jorge.mendoza@sozu.com,rodrigo.terveen@sozu.com",
    "telefono": "+5217225458999,+5218899556633",
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

---

## Nota Adicional

El componente `PhoneDisplay.tsx` también tiene el mismo problema con códigos hardcodeados. Se recomienda crear un servicio/hook compartido para obtener los códigos de países de la BD y reutilizarlo en toda la aplicación.

