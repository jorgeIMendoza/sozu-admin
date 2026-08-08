// Bytes de los documentos subidos, EN MEMORIA (no en el store persistido):
// los File no se pueden serializar a localStorage, así que el store solo guarda
// metadatos (filename, campos extraídos). Aquí conservamos el contenido en
// base64 durante la sesión para enviarlo a `registrar-solicitud-propietario` al
// terminar el wizard. Un reload de la página los pierde (igual que cualquier
// File); el envío degrada saltando los documentos cuyo contenido ya no esté.

export interface DocBytes {
  base64: string;
  filename: string;
  contentType: string;
}

const bytesById = new Map<string, DocBytes>();

export function setDocBytes(id: string, bytes: DocBytes): void {
  bytesById.set(id, bytes);
}

export function getDocBytes(id: string): DocBytes | undefined {
  return bytesById.get(id);
}

export function removeDocBytes(id: string): void {
  bytesById.delete(id);
}

export function clearDocBytes(): void {
  bytesById.clear();
}

/** Lee un File como base64 (sin el prefijo data:), en chunks para archivos grandes. */
export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
