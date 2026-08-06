# supabase/functions — casi vacío a propósito

Las Edge Functions de SOZU **no viven aquí**. Su fuente es el repositorio
[`sozu-edge-functions`](https://github.com/jorgeIMendoza/sozu-edge-functions),
que las despliega por CI: rama `dev` → VPS de desarrollo, rama `main` → Supabase
Cloud de producción.

Este directorio tenía 63 copias que quedaron congeladas el 2026-07-13 y siguieron
divergiendo de lo desplegado. Al leerlas se sacaban conclusiones falsas sobre el
código en producción, así que se borraron. Su contenido sigue en el historial de
git si hiciera falta consultarlo.

## Por qué sobrevive `verificar-documento-pdf`

Es la única cuyo código no existe en `sozu-edge-functions`. Está `ACTIVE` en
producción (desplegada a mano, no por CI), pero ningún cliente la invoca: sus
expresiones regulares se portaron al front en
[`src/utils/pdfDocumentExtractors.ts`](../../src/utils/pdfDocumentExtractors.ts)
y la validación de PDFs ocurre ahí.

Queda como respaldo de una función viva sin otra fuente. Para cerrarlo del todo
hacen falta dos pasos que van por separado: dar de baja la función en el proyecto
de Supabase y luego borrar esta carpeta.

## No agregar funciones aquí

Una Edge Function nueva se crea en `sozu-edge-functions`. Un archivo en este
directorio no se despliega a ningún lado.
