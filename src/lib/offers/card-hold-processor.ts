import type { HoldData } from "./formal-reservation-data";

export const HOLD_AMOUNT_MXN = 10000;
export const HOLD_DAYS = 5;

// SWAP POINT: en producción integrar Stripe Payment Intents (manual capture)
// o Conekta Orders con preauth. Este mock simula el comportamiento de un hold real.

export interface CardInput {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
}

export const detectCardBrand = (cardNumber: string): HoldData["cardBrand"] => {
  const clean = cardNumber.replace(/\s/g, "");
  if (/^4/.test(clean)) return "visa";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "mastercard";
  if (/^3[47]/.test(clean)) return "amex";
  return "unknown";
};

export const processCardHold = async (cardData: CardInput): Promise<HoldData> => {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const clean = cardData.cardNumber.replace(/\s/g, "");
  const cardLast4 = clean.slice(-4);
  const cardBrand = detectCardBrand(clean);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + HOLD_DAYS);

  return {
    holdAuthorizationId: `AUTH-${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
    cardLast4,
    cardBrand,
    amountMXN: HOLD_AMOUNT_MXN,
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
    releasedAt: null,
  };
};
