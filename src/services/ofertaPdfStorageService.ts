import { supabase } from "@/integrations/supabase/client";

interface UploadAndSaveResult {
  url: string;
  filename: string;
}

export class OfertaPdfStorageService {
  
  /**
   * Verificar si ya existe URL para una oferta
   */
  async getExistingUrl(offerId: number): Promise<string | null> {
    const { data, error } = await supabase
      .from('ofertas')
      .select('url')
      .eq('id', offerId)
      .single();
    
    if (error) {
      console.warn('Error fetching existing URL:', error);
      return null;
    }
    
    return data?.url || null;
  }

  /**
   * Subir blob al bucket y guardar URL en BD
   */
  async uploadAndSave(
    offerId: number, 
    blob: Blob, 
    filename: string,
    isProduct: boolean = false
  ): Promise<UploadAndSaveResult> {
    // Crear path: propiedades/O_000123.pdf o productos/OP_000123.pdf
    const folder = isProduct ? 'productos' : 'propiedades';
    const path = `${folder}/${filename}`;

    console.log('Uploading PDF to storage:', path);

    // Subir al bucket
    const { error: uploadError } = await supabase.storage
      .from('ofertas')
      .upload(path, blob, { 
        contentType: 'application/pdf',
        upsert: true 
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw uploadError;
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('ofertas')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    console.log('PDF uploaded, public URL:', publicUrl);

    // Guardar URL en BD
    const { error: updateError } = await supabase
      .from('ofertas')
      .update({ url: publicUrl })
      .eq('id', offerId);

    if (updateError) {
      console.error('Error updating offer URL:', updateError);
      throw updateError;
    }

    console.log('URL saved to database for offer:', offerId);

    return { url: publicUrl, filename };
  }

  /**
   * Descargar archivo desde URL sin abrir nueva pestaña
   */
  async downloadFromUrl(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }
      const blob = await response.blob();
      this.downloadBlob(blob, filename);
    } catch (error) {
      console.error('Error downloading from URL:', error);
      throw error;
    }
  }

  /**
   * Descargar blob directamente (sin abrir nueva pestaña)
   */
  downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}

export const ofertaPdfStorageService = new OfertaPdfStorageService();
