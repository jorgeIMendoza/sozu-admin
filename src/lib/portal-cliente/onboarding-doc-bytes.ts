// Contenido de los documentos subidos, EN MEMORIA (no en el store persistido):
// los File no se pueden serializar a localStorage, así que el store solo guarda
// metadatos. Aquí conservamos el Blob durante la sesión para subirlo directo a
// Storage (uploadToSignedUrl) al terminar el wizard. Un reload de la página los
// pierde (igual que cualquier File); el envío degrada saltando los que falten.

export interface DocBytes {
  blob: Blob;
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
