
# Plan: Agregar funcionalidad de logs de actividad donde falta

## Resumen
Tras revisar la plataforma, identifiqué 21 páginas y múltiples componentes que realizan operaciones de creación, actualización, eliminación o restauración de datos sin registrar logs de actividad. Esto crea lagunas en el historial de auditoría del sistema.

## Archivos que requieren agregar activity logging

### Páginas de Administración (21 archivos)

| # | Archivo | Operaciones sin logging |
|---|---------|------------------------|
| 1 | `src/pages/admin/Servicios.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 2 | `src/pages/admin/Notarias.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 3 | `src/pages/admin/CategoriasProductos.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 4 | `src/pages/admin/Residentes.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 5 | `src/pages/admin/Productos.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 6 | `src/pages/admin/Modelos.tsx` | Eliminar, Restaurar modelos |
| 7 | `src/pages/admin/Bodegas.tsx` | Eliminar, Restaurar bodegas |
| 8 | `src/pages/admin/Estacionamientos.tsx` | Eliminar, Restaurar estacionamientos |
| 9 | `src/pages/admin/Proyectos.tsx` | Crear, Actualizar, Eliminar proyectos |
| 10 | `src/pages/admin/Prospectos.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 11 | `src/pages/admin/Compradores.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 12 | `src/pages/admin/Duenos.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 13 | `src/pages/admin/EntidadesLegales.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 14 | `src/pages/admin/RolesPermisos.tsx` | Crear/Editar roles, asignar permisos |
| 15 | `src/pages/admin/Bancos.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 16 | `src/pages/admin/Desarrolladores.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 17 | `src/pages/admin/RepresentantesLegales.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 18 | `src/pages/admin/RepresentantesComerciales.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 19 | `src/pages/admin/Vendedores.tsx` | Crear, Actualizar, Eliminar, Restaurar |
| 20 | `src/pages/admin/PagarComisiones.tsx` | Pagar comisiones individuales/masivas |
| 21 | `src/pages/admin/Reservas.tsx` | Gestión de reservas (via componentes) |

### Componentes que requieren logging (5 archivos)

| # | Archivo | Operaciones sin logging |
|---|---------|------------------------|
| 1 | `src/components/admin/NewReservaDialog.tsx` | Crear reserva |
| 2 | `src/components/admin/ProjectLegalEntitiesSection.tsx` | Agregar/quitar entidades legales |
| 3 | `src/components/admin/ProjectMultimediaSection.tsx` | Agregar multimedia |
| 4 | `src/components/admin/ModelCharacteristicsSection.tsx` | Gestión características |
| 5 | `src/components/admin/UserProjectAccessDialog.tsx` | Asignar acceso a proyectos |

---

## Implementación técnica

### Patrón a seguir

Para cada archivo, la implementación sigue estos pasos:

1. **Importar el hook:**
```typescript
import { useActivityLogger } from "@/hooks/useActivityLogger";
```

2. **Desestructurar las funciones necesarias:**
```typescript
const { 
  registrarCreacion, 
  registrarActualizacion, 
  registrarEliminacion, 
  registrarRestauracion 
} = useActivityLogger();
```

3. **Agregar llamadas en onSuccess de cada mutation:**

**Ejemplo para crear:**
```typescript
onSuccess: (data, variables) => {
  registrarCreacion('servicio', { 
    nombre: variables.nombre,
    id: data?.id 
  });
  // resto del código existente...
}
```

**Ejemplo para actualizar:**
```typescript
onSuccess: (data, variables) => {
  registrarActualizacion('servicio', 
    { id: editingEntity?.id, ...valorAnterior },
    { id: editingEntity?.id, ...variables }
  );
  // resto del código existente...
}
```

**Ejemplo para eliminar (soft delete):**
```typescript
onSuccess: (_, id) => {
  registrarEliminacion('servicio', { 
    id, 
    nombre: entityToDelete?.nombre 
  });
  // resto del código existente...
}
```

**Ejemplo para restaurar:**
```typescript
onSuccess: (_, id) => {
  registrarRestauracion('servicio',
    { id, activo: false },
    { id, activo: true }
  );
  // resto del código existente...
}
```

---

## Plan de ejecución por archivo

### Grupo 1: Catálogos simples (4 archivos)
- `Servicios.tsx` - 4 mutations (crear, actualizar, eliminar, restaurar)
- `CategoriasProductos.tsx` - 4 mutations
- `Bancos.tsx` - 4 mutations  
- `Notarias.tsx` - 4 mutations

### Grupo 2: Entidades persona (8 archivos)
- `Residentes.tsx` - 4 mutations
- `Prospectos.tsx` - 4 mutations
- `Compradores.tsx` - 4 mutations
- `Duenos.tsx` - 4 mutations
- `Vendedores.tsx` - 4 mutations
- `RepresentantesLegales.tsx` - 4 mutations
- `RepresentantesComerciales.tsx` - 4 mutations
- `Desarrolladores.tsx` - 4 mutations

### Grupo 3: Entidades empresariales (2 archivos)
- `EntidadesLegales.tsx` - 4 mutations
- `Proyectos.tsx` - Crear/Editar/Eliminar proyectos

### Grupo 4: Inventario (3 archivos)
- `Productos.tsx` - 4 mutations
- `Modelos.tsx` - Eliminar/Restaurar
- `Bodegas.tsx` - Eliminar/Restaurar
- `Estacionamientos.tsx` - Eliminar/Restaurar

### Grupo 5: Sistema y permisos (2 archivos)
- `RolesPermisos.tsx` - Crear/editar roles, toggle permisos
- `PagarComisiones.tsx` - Pagar comisiones

### Grupo 6: Componentes (5 archivos)
- `NewReservaDialog.tsx` - Crear reserva
- `ProjectLegalEntitiesSection.tsx` - Asignar/desasignar entidades
- `ProjectMultimediaSection.tsx` - Agregar multimedia
- `ModelCharacteristicsSection.tsx` - Toggle características
- `UserProjectAccessDialog.tsx` - Guardar acceso a proyectos

---

## Datos a registrar por entidad

| Entidad | Campos clave a registrar |
|---------|-------------------------|
| servicio | id, nombre, precio_lista, id_entidad_relacionada_dueno |
| notario | id, nombre, notaria, email |
| categoria | id, nombre |
| banco | id, nombre |
| residente | id, nombre_legal, email |
| prospecto | id, nombre_legal, email, id_proyecto, id_estatus_persona |
| comprador | id, nombre_legal, email, rfc |
| dueno | id, nombre_legal, email |
| vendedor | id, nombre_legal, email |
| representante_legal | id, nombre_legal, email |
| representante_comercial | id, nombre_legal, email |
| desarrollador | id, nombre_legal, nombre_comercial |
| entidad_legal | id, nombre_legal, tipo_entidad |
| proyecto | id, nombre, id_estatus_proyecto |
| producto | id, nombre, precio_lista, stock |
| modelo | id, nombre, id_proyecto |
| bodega | id, nombre, numero_propiedad |
| estacionamiento | id, nombre, numero_propiedad |
| rol | id, nombre |
| permiso | rol_id, submenu_id, permiso_id |
| comision | email_usuario, id_cuenta_cobranza, monto |
| reserva | id, fecha_reserva, hora_reserva, id_espacio |
| multimedia | id, url, tipo |
| caracteristica | id, nombre, ver_en_oferta |
| acceso_proyecto | usuario_email, proyecto_ids |

---

## Resultado esperado

Después de implementar estos cambios:
- Todas las operaciones CRUD en el sistema quedarán registradas
- El historial de actividad en LogsActividad mostrará un registro completo
- Se podrá auditar quién hizo qué cambio y cuándo
- Los errores también se registrarán para debugging
