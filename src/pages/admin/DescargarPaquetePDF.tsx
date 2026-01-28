import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileCode, FileImage, FileText, Loader2, CheckCircle2, Package } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

const FILES_TO_INCLUDE = [
  { path: "README.md", url: "/despia/paquete-pdf-ofertas/README.md", type: "text" },
  { path: "services/ofertaPdfNativeService.ts", url: "/despia/paquete-pdf-ofertas/services/ofertaPdfNativeService.ts", type: "text" },
  { path: "services/ofertaProductoPdfNativeService.ts", url: "/despia/paquete-pdf-ofertas/services/ofertaProductoPdfNativeService.ts", type: "text" },
  { path: "utils/fiscalDataValidation.ts", url: "/despia/paquete-pdf-ofertas/utils/fiscalDataValidation.ts", type: "text" },
  { path: "assets/icons/balcon.png", url: "/despia/paquete-pdf-ofertas/assets/icons/balcon.png", type: "binary" },
  { path: "assets/icons/banos.png", url: "/despia/paquete-pdf-ofertas/assets/icons/banos.png", type: "binary" },
  { path: "assets/icons/bodega.png", url: "/despia/paquete-pdf-ofertas/assets/icons/bodega.png", type: "binary" },
  { path: "assets/icons/estacionamiento.png", url: "/despia/paquete-pdf-ofertas/assets/icons/estacionamiento.png", type: "binary" },
  { path: "assets/icons/medios-banos.png", url: "/despia/paquete-pdf-ofertas/assets/icons/medios-banos.png", type: "binary" },
  { path: "assets/icons/recamaras.png", url: "/despia/paquete-pdf-ofertas/assets/icons/recamaras.png", type: "binary" },
];

const getFileIcon = (path: string) => {
  if (path.endsWith(".png")) return <FileImage className="h-4 w-4 text-green-500" />;
  if (path.endsWith(".ts")) return <FileCode className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
};

export default function DescargarPaquetePDF() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownload = async () => {
    setIsDownloading(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder("paquete-pdf-ofertas");

      if (!folder) {
        throw new Error("No se pudo crear la carpeta en el ZIP");
      }

      for (let i = 0; i < FILES_TO_INCLUDE.length; i++) {
        const file = FILES_TO_INCLUDE[i];
        
        try {
          const response = await fetch(file.url);
          
          if (!response.ok) {
            console.warn(`No se pudo descargar: ${file.url}`);
            continue;
          }

          if (file.type === "text") {
            const content = await response.text();
            folder.file(file.path, content);
          } else {
            const blob = await response.blob();
            folder.file(file.path, blob);
          }

          setProgress(Math.round(((i + 1) / FILES_TO_INCLUDE.length) * 100));
        } catch (error) {
          console.warn(`Error descargando ${file.path}:`, error);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      
      // Crear enlace de descarga
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = "paquete-pdf-ofertas.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("ZIP descargado exitosamente");
    } catch (error) {
      console.error("Error generando ZIP:", error);
      toast.error("Error al generar el archivo ZIP");
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          Descargar Paquete PDF de Ofertas
        </h1>
        <p className="text-muted-foreground mt-2">
          Descarga todos los archivos necesarios para implementar la generación de PDFs en otro proyecto.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Información del paquete */}
        <Card>
          <CardHeader>
            <CardTitle>Contenido del Paquete</CardTitle>
            <CardDescription>
              El ZIP incluye {FILES_TO_INCLUDE.length} archivos organizados en carpetas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {FILES_TO_INCLUDE.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                >
                  {getFileIcon(file.path)}
                  <code className="text-xs">{file.path}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dependencias */}
        <Card>
          <CardHeader>
            <CardTitle>Dependencias Requeridas</CardTitle>
            <CardDescription>
              Instala estas dependencias en tu proyecto destino
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              npm install jspdf
            </div>
          </CardContent>
        </Card>

        {/* Instrucciones */}
        <Card>
          <CardHeader>
            <CardTitle>Instrucciones de Instalación</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Descarga y descomprime el archivo ZIP</li>
              <li>Copia la carpeta <code className="bg-muted px-1 rounded">services/</code> a <code className="bg-muted px-1 rounded">src/services/</code></li>
              <li>Copia la carpeta <code className="bg-muted px-1 rounded">utils/</code> a <code className="bg-muted px-1 rounded">src/utils/</code></li>
              <li>Copia la carpeta <code className="bg-muted px-1 rounded">assets/icons/</code> a <code className="bg-muted px-1 rounded">src/assets/icons/</code></li>
              <li>Ajusta los imports si tu proyecto no usa el alias <code className="bg-muted px-1 rounded">@/</code></li>
              <li>Consulta el README.md para más detalles de uso</li>
            </ol>
          </CardContent>
        </Card>

        {/* Botón de descarga */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              {isDownloading ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Generando ZIP... {progress}%
                  </p>
                </>
              ) : (
                <Button size="lg" onClick={handleDownload} className="gap-2">
                  <Download className="h-5 w-5" />
                  Descargar paquete-pdf-ofertas.zip
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
