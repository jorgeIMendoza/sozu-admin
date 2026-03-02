
# Fix: Generar nueva CLABE STP al poner propiedad en Reventa

## Problema
Cuando una propiedad se pone en reventa mediante el `ReventaDialog`, la CLABE STP se borra (`clabe_stp_tmp_apartado: null`). Esto causa que las ofertas generadas para esas propiedades no muestren la seccion de datos bancarios, ya que no hay CLABE disponible.

Otros flujos similares (cancelacion de cuenta, juicio terminado) si generan una nueva CLABE al devolver la propiedad a "Disponible", usando `supabase.rpc('crear_referencia_bancaria', { id_er_dueno })`.

## Solucion

### Archivo: `src/components/admin/ReventaDialog.tsx`

Modificar la `mutationFn` del `reventaMutation` para:

1. **Obtener el `id_entidad_relacionada_dueno`** de la propiedad actual (ya existe como prop pero necesitamos consultarlo si no esta disponible como prop, o bien agregarlo como prop).
2. **Llamar a `crear_referencia_bancaria`** con ese ID para generar una nueva CLABE STP.
3. **Asignar la nueva CLABE** en el update en lugar de `null`.

El patron ya existe en `CancelCuentaDialog` y `JuicioTerminadoDialog`:

```text
// Paso 1: Obtener id_er_dueno de la propiedad
const { data: propData } = await supabase
  .from('propiedades')
  .select('id_entidad_relacionada_dueno')
  .eq('id', propertyId)
  .single();

// Paso 2: Generar nueva CLABE
let nuevaClabe = null;
if (propData?.id_entidad_relacionada_dueno) {
  const { data: clabeData } = await supabase
    .rpc('crear_referencia_bancaria', { 
      id_er_dueno: propData.id_entidad_relacionada_dueno 
    });
  nuevaClabe = clabeData;
}

// Paso 3: Asignar en el update
clabe_stp_tmp_apartado: nuevaClabe,  // en vez de null
```

### Correccion de propiedades existentes

Ademas, se ejecutara un UPDATE para las 5 propiedades de Margot que ya estan en reventa sin CLABE (IDs: 5062, 5085, 5097, 4842, 5112). Se generara una CLABE para cada una llamando a `crear_referencia_bancaria` con su respectivo `id_entidad_relacionada_dueno`.

### Invalidar ofertas afectadas

Se invalidaran (url = NULL) las ofertas de esas propiedades para que se regeneren con la nueva CLABE y muestren la seccion de datos bancarios.
