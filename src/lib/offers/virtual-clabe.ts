// SWAP POINT: en producción, la virtualCLABE viene del campo property.virtualCLABE
// generado al levantar el inventario en STP. Este helper es solo para mock.

const SOZU_STP_PREFIX = "646180"; // Prefijo STP de SOZU (mock)

// Hash simple determinístico a partir del propertyId/offerId
const hashStringToNumber = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Devuelve la CLABE virtual estable para una propiedad/oferta.
 * Determinística: el mismo id siempre genera la misma CLABE.
 *
 * @example
 * getVirtualCLABEForProperty("PROP-BOT-U709") // "646180123456789012"
 */
export const getVirtualCLABEForProperty = (propertyOrOfferId: string): string => {
  const hash = hashStringToNumber(propertyOrOfferId || "default");
  // Necesitamos 12 dígitos. Repetimos el hash si es necesario.
  let digits = hash.toString();
  while (digits.length < 12) digits += hashStringToNumber(digits).toString();
  const last12 = digits.slice(0, 12);
  return `${SOZU_STP_PREFIX}${last12}`;
};
