

## CRUD de Tipos de Cita dentro de Configuracion de Citas

Se agregara una seccion colapsable o card al inicio de la pagina (visible solo para Super Administrador) que permita gestionar los tipos de cita directamente desde la UI.

### Funcionalidad

- **Listar** todos los tipos de cita (activos e inactivos) en una tabla compacta
- **Agregar** un nuevo tipo con solo escribir el nombre y dar clic en un boton
- **Editar** el nombre de un tipo existente (inline o con input)
- **Desactivar/Reactivar** un tipo con un switch o boton de toggle

### Ubicacion en la UI

Se colocara como un Card colapsable (Collapsible) justo despues del titulo de la pagina y antes del selector de usuario. Solo visible para Super Administrador.

### Seccion tecnica

**Archivo a modificar:** `src/pages/admin/comunicacion/ConfiguracionCitas.tsx`

1. **Imports adicionales**: Agregar `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `Switch`, `Pencil`, `Plus`, `Settings2` de los componentes existentes.

2. **Nuevo query**: Fetch de todos los tipos de cita (incluyendo inactivos) para el CRUD:
   ```typescript
   const { data: allTiposCita } = useQuery({
     queryKey: ["tipos-cita-all"],
     queryFn: async () => {
       const { data } = await supabase.from("tipos_cita").select("*").order("id");
       return data || [];
     },
     enabled: isSuperAdmin,
   });
   ```

3. **Mutations**:
   - `addTipoCita`: INSERT en `tipos_cita` con nombre ingresado
   - `updateTipoCita`: UPDATE nombre por id
   - `toggleTipoCita`: UPDATE activo (true/false) por id
   - Todas invalidan queryKey `["tipos-cita"]` y `["tipos-cita-all"]`

4. **Estado local**:
   - `nuevoTipoNombre`: string para el input de agregar
   - `editingTipoId`: number | null para modo edicion inline
   - `editingTipoNombre`: string para el valor en edicion
   - `tiposCrudOpen`: boolean para el collapsible

5. **UI del CRUD** (dentro de un Collapsible):
   - Fila de agregar: Input + boton "Agregar"
   - Tabla con columnas: Nombre | Estado (Switch activo/inactivo) | Acciones (boton editar con icono lapiz)
   - Al editar, el nombre se convierte en Input inline con boton de guardar

6. **Restriccion**: El bloque completo solo se renderiza si `isSuperAdmin === true`

7. **Query existente de tiposCita** (linea 62-73): Se mantiene sin cambios ya que filtra solo activos para las tabs de configuracion de horarios.
