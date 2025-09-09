import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PersonFormProps {
  onSubmit: (data: { nombre: string; curp: string; url_documento_identificacion?: string }) => void;
  initialData?: { nombre: string; curp: string; url_documento_identificacion?: string };
  isLoading?: boolean;
  onCancel: () => void;
}

export function PersonForm({ onSubmit, initialData, isLoading, onCancel }: PersonFormProps) {
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [curp, setCurp] = useState(initialData?.curp || '');
  const [documentImageUrl, setDocumentImageUrl] = useState(initialData?.url_documento_identificacion || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApiProcessing, setIsApiProcessing] = useState(false);
  const { toast } = useToast();

  const handleCameraCapture = async () => {
    try {
      setIsProcessing(true);
      toast({
        title: "Activando cámara",
        description: "Preparando la cámara para tomar la foto...",
      });

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia no está soportado en este navegador');
      }

      // Request camera access with fallback options
      let stream;
      try {
        // Try with back camera first
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (err) {
        console.log('Back camera not available, trying front camera:', err);
        // Fallback to front camera or any available camera
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      }

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      
      // Create canvas for capture
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('No se pudo crear el contexto del canvas');
      }

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
      `;
      
      video.style.cssText = `
        max-width: 90%;
        max-height: 70%;
        border: 2px solid white;
        border-radius: 8px;
      `;
      
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        margin-top: 20px;
        display: flex;
        gap: 15px;
      `;
      
      const captureBtn = document.createElement('button');
      captureBtn.textContent = 'Tomar Foto';
      captureBtn.style.cssText = `
        padding: 12px 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: background-color 0.2s;
      `;
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.style.cssText = `
        padding: 12px 24px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: background-color 0.2s;
      `;
      
      // Add hover effects
      captureBtn.addEventListener('mouseenter', () => {
        captureBtn.style.background = '#0056b3';
      });
      captureBtn.addEventListener('mouseleave', () => {
        captureBtn.style.background = '#007bff';
      });
      
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = '#545b62';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = '#6c757d';
      });
      
      buttonContainer.appendChild(captureBtn);
      buttonContainer.appendChild(cancelBtn);
      overlay.appendChild(video);
      overlay.appendChild(buttonContainer);
      document.body.appendChild(overlay);
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          resolve(true);
        };
      });

      const cleanup = () => {
        console.log('Cleaning up camera resources');
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        setIsProcessing(false);
      };
      
      // Use addEventListener instead of onclick for better reliability
      captureBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Capture button clicked');
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          toast({
            title: "Error",
            description: "El video no está listo. Intenta de nuevo.",
            variant: "destructive",
          });
          return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
          console.log('Image blob created:', blob?.size, 'bytes');
          cleanup();
          if (blob) {
            await processImage(blob);
          } else {
            toast({
              title: "Error",
              description: "No se pudo capturar la imagen.",
              variant: "destructive",
            });
          }
        }, 'image/jpeg', 0.8);
      });
      
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Cancel button clicked');
        cleanup();
      });
      
      // Add escape key handler
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error de cámara",
        description: `${errorMessage}. Intenta subir una imagen desde tus archivos.`,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processImage(file);
    }
  };

  const processImage = async (imageFile: Blob) => {
    try {
      setIsApiProcessing(true);
      
      toast({
        title: "Procesando documento",
        description: "Extrayendo datos del documento...",
      });
      
      // Process with external API
      const formData = new FormData();
      formData.append('image', imageFile, 'documento.jpg');
      
      console.log('Sending image to API...');
      
      const response = await fetch('https://automatizacion-n8n.fbqqbe.easypanel.host/webhook/process-ine', {
        method: 'POST',
        body: formData,
      });
      
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('La API no devolvió ningún dato');
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('La respuesta de la API no es JSON válido');
      }
      
      console.log('Parsed API Response:', result);
      
      if (result && result.ok && result.data) {
        const data = result.data;
        if (data.nombres && data.apellidos && data.curp) {
          const fullName = `${data.nombres} ${data.apellidos}`;
          setNombre(fullName);
          setCurp(data.curp);
          
          // Create a blob URL for the image
          const imageUrl = URL.createObjectURL(imageFile);
          setDocumentImageUrl(imageUrl);
          
          toast({
            title: "Documento procesado exitosamente",
            description: "Los datos se han extraído del documento.",
          });
        } else {
          toast({
            title: "Advertencia",
            description: "No se pudieron extraer todos los datos del documento.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Advertencia", 
          description: "No se encontraron datos en la respuesta de la API.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Error processing image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error",
        description: `Error al procesar el documento: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsApiProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nombre.trim() || !curp.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }
    
    onSubmit({
      nombre: nombre.trim(),
      curp: curp.trim(),
      url_documento_identificacion: documentImageUrl || undefined,
    });
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingresa el nombre completo"
              readOnly
              className="bg-muted"
            />
          </div>
          
          <div>
            <Label htmlFor="curp">CURP *</Label>
            <Input
              id="curp"
              type="text"
              value={curp}
              onChange={(e) => setCurp(e.target.value)}
              placeholder="Ingresa la CURP"
              readOnly
              className="bg-muted"
            />
          </div>
          
          <div>
            <Label>Documento de Identificación</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCameraCapture}
                disabled={isProcessing || isApiProcessing}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                {isProcessing ? 'Procesando...' : 'Tomar Foto'}
              </Button>
              
              <Label htmlFor="file-upload" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProcessing || isApiProcessing}
                  className="w-full"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Archivo
                  </span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing || isApiProcessing}
                />
              </Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Toma una foto o sube una imagen del documento de identificación para extraer automáticamente los datos.
            </p>
            {isApiProcessing && (
              <div className="mt-3 flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-primary">Procesando documento...</span>
              </div>
            )}
            {documentImageUrl && !isApiProcessing && (
              <div className="mt-3">
                <img 
                  src={documentImageUrl} 
                  alt="Documento de identificación" 
                  className="w-24 h-16 object-cover rounded border"
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading || isProcessing || isApiProcessing}>
            {isLoading ? 'Guardando...' : initialData ? 'Actualizar' : 'Confirmar'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}