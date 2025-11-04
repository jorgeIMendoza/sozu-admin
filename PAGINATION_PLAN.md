# Plan de Implementación de Paginación

## Páginas que Necesitan Paginación

1. **Estacionamientos** - Query compleja con joins, actualmente trae todos los datos
2. **Bodegas** - Query compleja con joins, actualmente trae todos los datos  
3. **Vistas** - Usa useState en lugar de useQuery, filtra en memoria
4. **Productos** - Ya tiene paginación parcial pero mal implementada
5. **Compradores** - Query compleja con personas/entidades, trae todos los datos
6. **Duenos** - Query compleja con personas/entidades, trae todos los datos
7. **Residentes** - Query compleja con personas/entidades, trae todos los datos
8. **Prospectos** - Query compleja con personas/entidades, trae todos los datos

## Patrón a Aplicar (basado en Modelos.tsx)

### 1. Estados de Paginación
```typescript
const [currentPageActive, setCurrentPageActive] = useState(1);
const [currentPageDeleted, setCurrentPageDeleted] = useState(1);
const itemsPerPage = 50;
```

### 2. Queries con Paginación
```typescript
const { data: activeData } = useQuery({
  queryKey: ["items", "active", currentPageActive, searchTerm, filters],
  queryFn: async () => {
    const from = (currentPageActive - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    
    let query = supabase.from("table")
      .select("*", { count: 'exact' })
      .eq("activo", true);
    
    // Apply filters in query
    if (searchTerm) {
      query = query.ilike("nombre", `%${searchTerm}%`);
    }
    
    const { data, error, count } = await query
      .order("nombre")
      .range(from, to);
    
    return { items: data || [], count: count || 0 };
  },
});
```

### 3. Componente de Paginación
```typescript
{totalPages > 1 && (
  <Pagination>
    <PaginationContent>
      <PaginationPrevious onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} />
      {/* pagination items */}
      <PaginationNext onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} />
    </PaginationContent>
  </Pagination>
)}
```

## Desafíos Específicos

### Estacionamientos y Bodegas
- Requieren dos queries (una para datos base, otra para proyectos)
- Necesitan mantener los joins pero aplicar paginación
- Solución: Paginar la query principal, luego fetch projects para esa página

### Vistas
- Actualmente usa useState + fetchVistas()
- Necesita migrar a useQuery completamente
- Relativamente simple una vez migrado

### Páginas de Personas (Compradores, Duenos, Residentes, Prospectos)
- Queries muy complejas con múltiples joins
- Filtros complejos con entidades_relacionadas
- Solución: Mantener los joins, aplicar paginación con `.range()`

### Productos
- Ya tiene estructura de paginación pero no funciona bien
- Solo necesita corregir la implementación existente

## Orden de Implementación

1. ✅ Modelos - COMPLETADO
2. Vistas - Más simple, buen próximo paso
3. Productos - Corregir lo existente
4. Estacionamientos y Bodegas - Similar entre sí
5. Compradores, Duenos, Residentes, Prospectos - Los más complejos
