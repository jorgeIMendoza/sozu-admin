
## Plan de Implementación

### Resumen
Implementar dos funcionalidades:
1. **Copia de email al portapapeles** en la vista de Inmobiliarias
2. **Corrección del diálogo de acceso a proyectos** para usuarios con rol Inmobiliaria (4)

---

### Parte 1: Copiar email al hacer clic en la columna Usuario

**Archivo a modificar:** `src/pages/admin/Inmobiliarias.tsx`

**Cambios:**
- Agregar función `handleCopyEmail` que use `navigator.clipboard.writeText()`
- Mostrar un toast de confirmación cuando se copie
- Hacer el email clickeable con estilo de cursor pointer
- Agregar icono de copiar (Copy de lucide-react) para indicar la acción

**Código del cambio en la celda de Usuario (línea ~1017-1019):**
```tsx
<TableCell className="text-muted-foreground">
  {inmobiliaria.usuario_email ? (
    <button
      onClick={() => {
        navigator.clipboard.writeText(inmobiliaria.usuario_email!);
        toast({
          title: "Copiado",
          description: "Email copiado al portapapeles",
        });
      }}
      className="flex items-center gap-1 hover:text-primary cursor-pointer transition-colors"
      title="Clic para copiar"
    >
      {inmobiliaria.usuario_email}
      <Copy className="h-3 w-3 opacity-50" />
    </button>
  ) : (
    <span className="text-muted-foreground/50">Sin usuario</span>
  )}
</TableCell>
```

- Agregar `Copy` a los imports de lucide-react

---

### Parte 2: Diálogo de Acceso para Usuarios Inmobiliaria

**Archivo a modificar:** `src/components/admin/UserProjectAccessDialog.tsx`

**Problema identificado:**
El diálogo tiene manejo especial para Agentes Inmobiliarios (rol 3), mostrando que heredan accesos de su Inmobiliaria padre. Sin embargo, falta el manejo inverso: mostrar a los usuarios con rol Inmobiliaria (4) que sus cambios propagarán a todos sus agentes.

**Cambios:**
1. Agregar verificación para `isInmobiliaria` (rol 4)
2. Agregar alerta informativa indicando que los cambios se propagarán a los agentes
3. Mostrar contador de agentes afectados

**Agregar constante y query (después de línea ~64):**
```tsx
// Check if user is Inmobiliaria (role 4)
const isInmobiliaria = userRoleId === 4;

// Query to get agent count for this inmobiliaria
const { data: agentCount } = useQuery({
  queryKey: ['inmobiliaria-agent-count', userPersonaId],
  queryFn: async () => {
    if (!userPersonaId) return 0;
    const { count, error } = await supabase
      .from('entidades_relacionadas')
      .select('*', { count: 'exact', head: true })
      .eq('id_persona_duena_lead', userPersonaId)
      .eq('id_tipo_entidad', 19) // Agente
      .eq('activo', true);
    if (error) return 0;
    return count || 0;
  },
  enabled: open && isInmobiliaria && !!userPersonaId,
});
```

**Agregar alerta informativa en el UI (en la sección de proyectos, antes del search input):**
```tsx
{isInmobiliaria && agentCount > 0 && (
  <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950/20">
    <Users className="h-4 w-4 text-green-600" />
    <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
      Los cambios de acceso se propagarán automáticamente a los 
      <strong> {agentCount} agente{agentCount !== 1 ? 's' : ''}</strong> de esta inmobiliaria.
    </AlertDescription>
  </Alert>
)}
```

---

### Verificación del Trigger Existente

El trigger `sync_inmobiliaria_project_access` ya está implementado y debería propagar automáticamente los cambios. El trigger:
- Detecta cuando el usuario que modifica accesos tiene rol 4 (Inmobiliaria)
- Encuentra todos los agentes vinculados a esa inmobiliaria
- Propaga INSERT/UPDATE/DELETE de accesos a todos los agentes

**Nota:** El trigger ya está configurado correctamente. Si hay errores al guardar, podrían ser de RLS o de la lógica del componente. La propagación a agentes funcionará automáticamente una vez que el guardado sea exitoso.

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/admin/Inmobiliarias.tsx` | Agregar funcionalidad de copiar email + import `Copy` |
| `src/components/admin/UserProjectAccessDialog.tsx` | Agregar alerta informativa para rol Inmobiliaria con conteo de agentes |

---

### Detalles Técnicos Adicionales

**Flujo de propagación de accesos:**
1. Usuario con rol Inmobiliaria (4) selecciona proyectos en el diálogo
2. Al guardar, se insertan/actualizan registros en `proyectos_acceso`
3. El trigger `sync_inmobiliaria_project_access` se dispara automáticamente
4. El trigger encuentra agentes vinculados via `entidades_relacionadas` (tipo 19)
5. Los mismos accesos se replican a cada agente

**Constraint de la tabla proyectos_acceso:**
- Primary key compuesta: `(usuario_id, proyecto_id)`
- El trigger usa `ON CONFLICT` para manejar duplicados
