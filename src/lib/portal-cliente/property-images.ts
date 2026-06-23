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

// Fallback by lowercase project name prefix
const projectImages: Record<string, string> = {
  bottura: botturaImg,
  daiku: daikuImg,
  margot: margotImg,
};

/**
 * Get hero image for a property.
 * First tries legacy slug ID, then project name prefix fallback.
 */
export function getPropertyImage(propertyId: string, projectName?: string): string | undefined {
  if (propertyImages[propertyId]) return propertyImages[propertyId];
  if (projectName) {
    const key = projectName.toLowerCase().split(/[\s-_]/)[0];
    return projectImages[key];
  }
  return undefined;
}

