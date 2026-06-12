// Centralized property image mapping
import botturaImg from "@/assets/bottura.jpg";
import bottura812Img from "@/assets/bottura-812.jpg";
import margotImg from "@/assets/margot.jpg";
import daikuImg from "@/assets/daiku.png";

const propertyImages: Record<string, string> = {
  "bottura-709": botturaImg,
  "bottura-812": bottura812Img,
  "bottura-915": bottura812Img,
  "margot-707": margotImg,
  "daiku-712": daikuImg,
};

/** Get the hero image for a property by its ID */
export function getPropertyImage(propertyId: string): string | undefined {
  return propertyImages[propertyId];
}
