import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/**
 * Texto plano de un PDF, para validar y extraer datos de documentos oficiales
 * (Constancia de Situación Fiscal, CURP, acta…). Un escaneo o una imagen dentro
 * de un PDF devuelve texto vacío: quien llama debe tratarlo como documento no
 * válido y pedir el PDF original.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages.join('\n').trim();
}
