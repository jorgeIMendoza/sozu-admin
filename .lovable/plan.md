

## Preview con Placeholders Editables en el Editor de Templates

### Resumen

Al editar un template (como la Carta de Acuerdos), el editor mostrara dos columnas:
- **Izquierda**: El RichTextEditor con el contenido y placeholders como chips no editables
- **Derecha**: Una seccion de "Vista Previa" que incluye campos de texto para dar valor a cada placeholder y un iframe que renderiza el HTML final con los valores reemplazados en tiempo real

---

### Cambios

#### 1. Ampliar la interfaz del `RichTextEditor`

Agregar una prop opcional `placeholders` al componente:

```text
placeholders?: Array<{ key: string; label: string }>
```

Cuando esta prop esta presente, el editor:
- Muestra un boton "Insertar Placeholder" en la toolbar (dropdown con la lista de placeholders disponibles)
- Registra la extension TipTap `PlaceholderNode` (nodo inline atom, no editable, con fondo violeta)

#### 2. Crear extension TipTap `PlaceholderNode`

Nuevo archivo `src/lib/tiptap-placeholder-extension.ts`:
- Nodo inline `atom` (no editable, se borra completo)
- Atributo `key` (ej: `nombre_agente`)
- Renderiza como `<span data-placeholder="key" class="placeholder-node">key</span>`
- CSS: fondo indigo-100, texto indigo-700, bordes redondeados, `user-select: none`

#### 3. Crear componente `TemplateEditorWithPreview`

Nuevo archivo `src/components/admin/TemplateEditorWithPreview.tsx`:

Layout en dos columnas (`grid grid-cols-1 lg:grid-cols-2 gap-6`):

**Columna izquierda - Editor:**
- El `RichTextEditor` con la prop `placeholders` activada
- Los placeholders aparecen como chips violetas no editables dentro del texto

**Columna derecha - Vista Previa:**
- Seccion superior: campos Input para cada placeholder
  - `nombre_agente` -> Input con label "Nombre completo del agente"
  - `fecha_actual` -> Input con label "Fecha actual" (prellenado con la fecha de hoy, editable)
  - `fecha_fin` -> Input con label "Fecha fin" (prellenado con fecha + 3 meses, editable)
- Seccion inferior: iframe con el HTML renderizado donde los `<span data-placeholder="X">` se reemplazan por los valores escritos en los inputs, actualizandose en tiempo real conforme el usuario escribe

El componente recibe las mismas props que el RichTextEditor mas la config de placeholders, y se encarga internamente de:
1. Mantener un estado `placeholderValues: Record<string, string>` con los valores de cada campo
2. En cada cambio del HTML del editor o de un valor de placeholder, generar el HTML de preview reemplazando los spans
3. Renderizar el preview en un iframe con `srcDoc`

#### 4. Utilidad de reemplazo de placeholders

Nuevo archivo `src/utils/templatePlaceholders.ts`:

```text
function replacePlaceholders(html: string, values: Record<string, string>): string
```

Busca todos los `<span data-placeholder="key">...</span>` y los reemplaza por el valor correspondiente. Si no hay valor, muestra el key entre corchetes como fallback visual (ej: `[nombre_agente]`).

#### 5. Estilos CSS

Agregar en `src/index.css` dentro de la seccion de TipTap:

- `.placeholder-node`: fondo indigo-100, color indigo-700, border-radius 4px, padding 1px 6px, font-family monospace, font-size 0.85em

---

### Archivos a crear

| Archivo | Descripcion |
|---|---|
| `src/lib/tiptap-placeholder-extension.ts` | Extension TipTap para nodo PlaceholderNode |
| `src/components/admin/TemplateEditorWithPreview.tsx` | Componente con editor + preview lado a lado |
| `src/utils/templatePlaceholders.ts` | Funcion para reemplazar placeholders en HTML |

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/admin/RichTextEditor.tsx` | Agregar prop `placeholders`, registrar extension PlaceholderNode, agregar boton "Insertar Placeholder" en toolbar |
| `src/index.css` | Agregar estilos para `.placeholder-node` |

### Flujo del usuario

1. Abre el editor del template de la carta
2. Escribe contenido con formato rico (negritas, listas, etc.)
3. Click en boton "Placeholder" de la toolbar -> selecciona `nombre_agente`
4. Aparece chip violeta `nombre_agente` en el texto, no editable
5. En la columna derecha, escribe "Juan Perez Lopez" en el campo "Nombre completo del agente"
6. El preview se actualiza en tiempo real mostrando "Juan Perez Lopez" donde estaba el chip
7. `fecha_actual` y `fecha_fin` se prellenan automaticamente pero son editables

