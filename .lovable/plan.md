
# Ajuste de Branding para Rol Inmobiliaria

## Resumen
Cambios en la interfaz para usuarios con rol Inmobiliaria para corregir la ubicacion del nombre de la inmobiliaria y mejorar el texto del Dashboard.

## Cambios a Realizar

### 1. Sidebar Header (AdminSidebar.tsx)
**Antes:** Muestra el nombre de la inmobiliaria + "By Sozu"
**Despues:** Mostrar solo "By Sozu" con el logo de Sozu (igual que otros roles pero con texto "By Sozu")

```text
+------------------+
| [S] By Sozu      |
|     Admin Panel  |
+------------------+
```

### 2. Dashboard Header (Dashboard.tsx)
**Antes:** Solo muestra el titulo "Proyectos gestionados por Sozu"
**Despues:** Para rol Inmobiliaria, mostrar un header con el logo y nombre de la inmobiliaria (similar al componente InmobiliariaHeader existente)

```text
+------------------------------------------+
| [Logo]  Nombre de la Inmobiliaria        |
|         Nombre Legal (si es diferente)   |
+------------------------------------------+
```

### 3. Titulo del Dashboard (Dashboard.tsx)
**Antes:** "Proyectos gestionados por Sozu"
**Despues:** Para rol Inmobiliaria: "Proyectos Comercializados por {nombre_inmobiliaria}"

---

## Detalles Tecnicos

### Archivo: src/components/admin/AdminSidebar.tsx (lineas 361-395)

Modificar el header del sidebar para rol Inmobiliaria:
- Remover la visualizacion del nombre/logo de la inmobiliaria
- Mostrar "By Sozu" con el icono/logo de Sozu
- Mantener el subtitulo "Admin Panel"

Codigo propuesto:
```tsx
// Para Inmobiliaria role - mostrar "By Sozu" en lugar del nombre de la inmobiliaria
{isInmobiliariaRole ? (
  <div className="flex items-center space-x-3">
    <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
      <span className="text-primary-foreground font-bold text-sm">S</span>
    </div>
    <div>
      <h1 className="font-bold text-lg">By Sozu</h1>
      <p className="text-xs text-muted-foreground">Admin Panel</p>
    </div>
  </div>
) : (
  // Default header for other roles...
)}
```

### Archivo: src/pages/admin/Dashboard.tsx (lineas 1-290)

1. Importar useAuth y useQuery para obtener datos de la inmobiliaria
2. Agregar query para obtener nombre y logo de la inmobiliaria del usuario
3. Agregar header visual con logo y nombre para usuarios Inmobiliaria
4. Cambiar titulo dinamicamente segun el rol:
   - Rol Inmobiliaria: "Proyectos Comercializados por {nombre}"
   - Otros roles: "Proyectos gestionados por Sozu"

Codigo propuesto:
```tsx
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Dentro del componente Dashboard:
const { profile } = useAuth();
const isInmobiliariaRole = profile?.rol_id === 4;

// Query para obtener datos de la inmobiliaria
const { data: inmobiliariaData } = useQuery({
  queryKey: ['dashboard-inmobiliaria-data', profile?.id_persona],
  queryFn: async () => {
    const { data } = await supabase
      .from('personas')
      .select('nombre_legal, nombre_comercial, url_logo')
      .eq('id', profile.id_persona)
      .single();
    return data;
  },
  enabled: isInmobiliariaRole && !!profile?.id_persona,
});

// En el JSX:
{isInmobiliariaRole && inmobiliariaData && (
  <Card className="mb-6 border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md">
    <CardContent className="py-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 ring-2 ring-primary/20">
          {inmobiliariaData.url_logo && (
            <AvatarImage src={inmobiliariaData.url_logo} />
          )}
          <AvatarFallback>
            {inmobiliariaData.nombre_legal?.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">
            {inmobiliariaData.nombre_comercial || inmobiliariaData.nombre_legal}
          </h2>
        </div>
      </div>
    </CardContent>
  </Card>
)}

<h1 className="text-3xl font-bold text-foreground">
  {isInmobiliariaRole && inmobiliariaData
    ? `Proyectos Comercializados por ${inmobiliariaData.nombre_comercial || inmobiliariaData.nombre_legal}`
    : 'Proyectos gestionados por Sozu'}
</h1>
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/admin/AdminSidebar.tsx` | Simplificar header para mostrar "By Sozu" en lugar del nombre de inmobiliaria |
| `src/pages/admin/Dashboard.tsx` | Agregar header con logo/nombre y cambiar titulo dinamico |

## Resultado Visual Esperado

Para usuario con rol Inmobiliaria:

**Sidebar:**
```text
[S] By Sozu
    Admin Panel
```

**Dashboard:**
```text
+------------------------------------------+
| [Logo]  Inmobiliaria Prueba              |
+------------------------------------------+

Proyectos Comercializados por Inmobiliaria Prueba

[Cards de proyectos...]
```
