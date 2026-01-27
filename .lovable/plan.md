

# Plan: Mejorar Selector de Dueño para Productos, Servicios y Mantenimientos

## Resumen

Implementar las siguientes mejoras en los selectores de "Dueño" para productos y servicios:

1. **Mostrar solo dueños con `cuenta_madre_stp` configurada**
2. **Mostrar nombre + cuenta madre con énfasis en los últimos 4 dígitos**
3. **Aplicar cambios en 3 lugares**: 
   - `Productos.tsx` (crear/editar productos)
   - `Servicios.tsx` (crear/editar servicios)
   - `ProjectLegalEntitiesSection.tsx` (editar proyectos de tipo Productos/Servicios/Mantenimientos)

---

## Archivos a Modificar

### 1. `src/pages/admin/Productos.tsx`

**Cambios en la query de entidades (líneas 122-155):**
- Agregar `cuenta_madre_stp` al select
- Agregar filtro `.not('cuenta_madre_stp', 'is', null)`
- Incluir `cuenta_madre_stp` en el mapeo de datos

**Cambios en el Select de Dueño (líneas 806-825):**
- Mostrar nombre + cuenta madre con últimos 4 dígitos en bold y color primario
- Mostrar mensaje cuando no hay dueños con cuenta madre configurada

---

### 2. `src/pages/admin/Servicios.tsx`

**Cambios en la query de entidades (líneas 81-114):**
- Agregar `cuenta_madre_stp` al select
- Agregar filtro `.not('cuenta_madre_stp', 'is', null)`
- Incluir `cuenta_madre_stp` en el mapeo de datos

**Cambios en el Select de Dueño (líneas 686-705):**
- Mostrar nombre + cuenta madre con últimos 4 dígitos en bold y color primario
- Mostrar mensaje cuando no hay dueños con cuenta madre configurada

---

### 3. `src/components/admin/ProjectLegalEntitiesSection.tsx`

Este componente se usa al editar proyectos de tipo Productos (id_tipo_uso=9), Servicios (id_tipo_uso=10) y Mantenimientos (id_tipo_uso=11).

**Actualmente no hay validación** de que los dueños tengan `cuenta_madre_stp` al agregarlos al proyecto. Los cambios aquí son:

**Opción 1 - Validación al guardar cuenta_madre_stp (líneas 376-411):**
- Agregar validación para evitar que se asigne una cuenta madre que ya esté en uso por otra entidad **del mismo proyecto de tipo Productos/Servicios/Mantenimientos**
- Las cuentas madre de propiedades pueden repetirse para productos (según lo indicado)

**Opción 2 - Mostrar advertencia visual:**
- Cuando se selecciona una persona que ya tiene entidades en otros proyectos con `cuenta_madre_stp`, mostrar advertencia informativa

---

## Detalles Técnicos

### Estructura del Select con cuenta madre

```text
┌──────────────────────────────────────────────────────┐
│  Dueño *                                              │
├──────────────────────────────────────────────────────┤
│  ▼ Selecciona un dueño                               │
├──────────────────────────────────────────────────────┤
│  Tallwood          64618028740013                    │
│                              ^^^^                    │
│                    (últimos 4 en bold + color)       │
│  Desarrolladora X  64618028740256                    │
│  Inversiones Y     64618028740338                    │
└──────────────────────────────────────────────────────┘
```

### Código del SelectItem (ejemplo)

```tsx
<SelectItem key={entidad.id} value={entidad.id.toString()}>
  <div className="flex items-center gap-2">
    <span>{entidad.nombre_legal}</span>
    <span className="text-muted-foreground font-mono text-xs">
      {entidad.cuenta_madre_stp.slice(0, -4)}
      <span className="font-bold text-primary">
        {entidad.cuenta_madre_stp.slice(-4)}
      </span>
    </span>
  </div>
</SelectItem>
```

### Query modificada (ejemplo para Productos)

```typescript
const { data: entidadesRelacionadas = [] } = useQuery({
  queryKey: ['entidades-relacionadas-productos'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('entidades_relacionadas')
      .select(`
        id,
        id_persona,
        id_proyecto,
        cuenta_madre_stp,
        personas!entidades_relacionadas_id_persona_fkey (
          nombre_legal
        ),
        proyectos!entidades_relacionadas_id_proyecto_fkey (
          id_tipo_uso
        )
      `)
      .in('id_tipo_entidad', [4, 8, 13])
      .eq('activo', true)
      .not('id_proyecto', 'is', null)
      .not('cuenta_madre_stp', 'is', null);  // Solo con cuenta madre
    if (error) throw error;
    
    const filteredData = (data || []).filter((item: any) => 
      item.proyectos && item.proyectos.id_tipo_uso === 9
    );
    
    return filteredData.map((item: any) => ({
      id: item.id,
      nombre_legal: item.personas?.nombre_legal || 'Sin nombre',
      cuenta_madre_stp: item.cuenta_madre_stp
    })).sort((a, b) => 
      a.nombre_legal.localeCompare(b.nombre_legal)
    );
  },
});
```

---

## Resumen de Cambios por Archivo

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/Productos.tsx` | Query: agregar `cuenta_madre_stp`, filtrar solo con cuenta madre. UI: mostrar cuenta madre en selector |
| `src/pages/admin/Servicios.tsx` | Query: agregar `cuenta_madre_stp`, filtrar solo con cuenta madre. UI: mostrar cuenta madre en selector |
| `src/components/admin/ProjectLegalEntitiesSection.tsx` | Validación opcional al guardar cuenta madre para evitar duplicados dentro del mismo tipo de proyecto |

---

## Nota sobre Mantenimientos

Los proyectos de tipo Mantenimientos (`id_tipo_uso = 11`) usan la misma lógica que Servicios. Si hay una página separada para gestionar entidades de mantenimientos, se aplicarían los mismos cambios. Actualmente, la gestión de entidades legales para todos estos tipos de proyecto se hace a través de `ProjectLegalEntitiesSection.tsx` cuando se edita el proyecto.

