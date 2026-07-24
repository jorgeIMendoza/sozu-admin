// SOZU · Onboarding "Registrar mi propiedad" — Assets del desarrollo Margot
//
// Binarios descargados del prototipo Lovable y re-hospedados en src/assets/onboarding/.
// Si algún asset falta, el flujo degrada con gracia (ícono/texto/gradiente).
//
// IMPORTANTE: importar aquí SOLO archivos que existan en el repo. Vite resuelve
// estos imports en build time, así que un binario ausente no degrada: rompe el
// build completo con "Could not load ... ENOENT". Al subir un archivo nuevo a
// src/assets/onboarding/, reemplaza su `undefined` por el import correspondiente.
//
// Nota: src/assets/onboarding/ está exceptuado en .gitignore (regla
// `!src/assets/onboarding/*.png`) porque `*.png` se ignora por defecto.

import margotFachadaImg from "@/assets/onboarding/margot-fachada.jpeg";
import margotWordmarkImg from "@/assets/onboarding/margot-wordmark.png";
import margotWordmarkLightImg from "@/assets/onboarding/margot-wordmark-light.png";
import margotIsotipoImg from "@/assets/onboarding/margot-isotipo.png";
import margotKindPlantaImg from "@/assets/onboarding/margot-kind-planta.png";

export const margotFachada: string | undefined = margotFachadaImg;
export const margotWordmark: string | undefined = margotWordmarkImg;
export const margotWordmarkLight: string | undefined = margotWordmarkLightImg;
export const margotIsotipo: string | undefined = margotIsotipoImg;
export const margotKindPlanta: string | undefined = margotKindPlantaImg;
