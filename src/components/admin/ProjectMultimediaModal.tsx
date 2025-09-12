import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Image, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MultimediaItem {
  id: number;
  url: string;
  es_imagen: boolean;
}

interface ProjectMultimediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  multimedia: MultimediaItem[];
  projectName: string;
}

export const ProjectMultimediaModal = ({ 
  isOpen, 
  onClose, 
  multimedia, 
  projectName 
}: ProjectMultimediaModalProps) => {
  const images = multimedia.filter(item => item.es_imagen);
  const videos = multimedia.filter(item => !item.es_imagen);

  const renderImage = (item: MultimediaItem) => (
    <div key={item.id} className="group relative overflow-hidden rounded-lg border bg-card">
      <img
        src={item.url}
        alt={`Imagen del proyecto ${projectName}`}
        className="w-full h-48 object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <Button
          variant="secondary"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => window.open(item.url, '_blank')}
        >
          Ver completa
        </Button>
      </div>
    </div>
  );

  const renderVideo = (item: MultimediaItem) => (
    <div key={item.id} className="group relative overflow-hidden rounded-lg border bg-card">
      <div className="w-full h-48 bg-muted flex items-center justify-center">
        <Video className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-2">Video del proyecto</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(item.url, '_blank')}
        >
          <Video className="h-4 w-4 mr-2" />
          Ver video
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              Multimedia - {projectName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="images" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Imágenes
              <Badge variant="secondary">{images.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videos
              <Badge variant="secondary">{videos.length}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="images" className="mt-6">
            <div className="max-h-[400px] overflow-y-auto">
              {images.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map(renderImage)}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay imágenes disponibles</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="videos" className="mt-6">
            <div className="max-h-[400px] overflow-y-auto">
              {videos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videos.map(renderVideo)}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay videos disponibles</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};