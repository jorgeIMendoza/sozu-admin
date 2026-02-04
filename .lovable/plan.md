

# Plan: Agregar Link al mensajeWA

## Cambio Requerido

El mensaje de WhatsApp (`mensajeWA`) debe incluir el link `admin.sozu.com` para que el usuario sepa donde acceder.

---

## Seccion Tecnica

### Archivo a Modificar
`src/pages/admin/Inmobiliarias.tsx`

### Cambio en linea 1077

**Antes:**
```typescript
mensajeWA: `Tu inmobiliaria *${inmobiliaria.nombre_legal}* ha sido aprobada.\nUsuario: ${inmobiliaria.email}\nPassword: Temporal123!`,
```

**Despues:**
```typescript
mensajeWA: `Tu inmobiliaria *${inmobiliaria.nombre_legal}* ha sido aprobada.\nLink: admin.sozu.com\nUsuario: ${inmobiliaria.email}\nPassword: Temporal123!`,
```

---

## Ejemplo de Mensaje Final para Publik

```
Tu inmobiliaria *Publik Inmobiliaria S.A. de C.V.* ha sido aprobada.
Link: admin.sozu.com
Usuario: contacto@publik.mx
Password: Temporal123!
```

