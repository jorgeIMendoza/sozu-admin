// SOZU · Onboarding "Registrar mi propiedad" — Assets del desarrollo Margot
//
// Binarios descargados del prototipo Lovable y re-hospedados en src/assets/onboarding/.
// Si algún asset falta, el flujo degrada con gracia (ícono/texto/gradiente).
//
// IMPORTANTE: importar aquí SOLO archivos que existan en el repo. Vite resuelve
// estos imports en build time, así que un binario ausente no degrada: rompe el
// build completo con "Could not load ... ENOENT". Al subir un archivo nuevo a
// src/assets/onboarding/, reemplaza su `undefined` por el import correspondiente.

import margotFachadaImg from "@/assets/onboarding/margot-fachada.jpeg";

export const margotFachada: string | undefined = margotFachadaImg;

// Pendientes de subir a src/assets/onboarding/ (ver README.md de esa carpeta).
// Mientras falten, la UI usa sus fallbacks: el chip del desarrollo muestra el
// nombre en texto y el plano de la unidad no se renderiza.
export const margotWordmark: string | undefined = undefined;
export const margotWordmarkLight: string | undefined = undefined;
export const margotIsotipo: string | undefined = undefined;
export const margotKindPlanta: string | undefined = undefined;
