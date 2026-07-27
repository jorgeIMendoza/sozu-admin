// Fuente única de verdad: `@/lib/image-transform`.
//
// Este archivo existía como copia paralela y divergió: le faltaba el default
// `resize="contain"`, por lo que las transformaciones con solo `width` volvían
// con el ALTO ORIGINAL (p.ej. 640x1330 en vez de 640x193) y deformaban la
// imagen a una tira vertical. `OptImg` usa este módulo, así que ese bug se veía
// en Vistas/Modelos del portal. Reexportamos la implementación correcta para
// que no vuelva a divergir.
export { optimizedImage, default } from "@/lib/image-transform";
export type { ImageTransformOpts } from "@/lib/image-transform";
