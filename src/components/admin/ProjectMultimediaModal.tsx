import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Image, Video, Youtube, Images, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { optimizedImage } from "@/lib/image-transform";

interface MultimediaItem {
  id: number;
  url: string;
  es_imagen: boolean;
  activo?: boolean;
}

interface YouTubeVideo {
  id: number;
  nombre: string;
  link: string;
  activo?: boolean;
}

interface ProjectMultimediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  multimedia: MultimediaItem[];
  youtubeVideos?: YouTubeVideo[];
  projectName: string;
}

export const ProjectMultimediaModal = ({ 
  isOpen, 
  onClose, 
  multimedia, 
  youtubeVideos = [],
  projectName 
}: ProjectMultimediaModalProps) => {
  const images = multimedia.filter(item => item.es_imagen && item.activo !== false);
  const videos = multimedia.filter(item => !item.es_imagen && item.activo !== false);
  const activeYoutubeVideos = youtubeVideos.filter(v => v.activo !== false);

  const getYouTubeEmbedUrl = (link: string) => {
    // Handle different YouTube URL formats
    const videoIdMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (videoIdMatch) {
      return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
    }
    return link;
  };

  const EmptyState = ({ icon: Icon, label }: { icon: typeof Image; label: string }) => (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
      <Icon className="mb-3 h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );

  const renderImage = (item: MultimediaItem) => (
    <div key={item.id} className="group relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
      <img
        src={optimizedImage(item.url, { width: 480, height: 384, resize: "cover" })}
        alt={`Imagen del proyecto ${projectName}`}
        loading="lazy"
        className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
        <Button
          variant="secondary"
          size="sm"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => window.open(item.url, '_blank')}
        >
          <ExternalLink className="mr-1 h-4 w-4" />
          Ver completa
        </Button>
      </div>
    </div>
  );

  const renderVideo = (item: MultimediaItem) => (
    <div key={item.id} className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
      <video
        src={item.url}
        controls
        className="h-48 w-full bg-muted object-cover"
        preload="metadata"
      >
        Tu navegador no soporta el elemento de video.
      </video>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Video className="h-4 w-4" />
          </span>
          Video del proyecto
        </span>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(item.url, '_blank')}>
          <ExternalLink className="mr-1 h-4 w-4" />
          Abrir
        </Button>
      </div>
    </div>
  );

  const renderYouTubeVideo = (video: YouTubeVideo) => (
    <div key={video.id} className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
      <div className="aspect-video bg-muted">
        <iframe
          src={getYouTubeEmbedUrl(video.link)}
          title={video.nombre}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-red-600/10 text-red-600">
            <Play className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-medium">{video.nombre}</span>
        </span>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(video.link, '_blank')}>
          <ExternalLink className="mr-1 h-4 w-4" />
          YouTube
        </Button>
      </div>
    </div>
  );



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Images className="h-4 w-4" />
            </span>
            <span className="truncate">Multimedia de {projectName}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="images" className="flex min-h-0 w-full flex-1 flex-col">
          <TabsList className="grid w-full shrink-0 grid-cols-3">
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
            <TabsTrigger value="youtube" className="flex items-center gap-2">
              <Youtube className="h-4 w-4" />
              YouTube
              <Badge variant="secondary">{activeYoutubeVideos.length}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="images" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {images.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {images.map(renderImage)}
              </div>
            ) : (
              <EmptyState icon={Image} label="No hay imágenes disponibles" />
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {videos.map(renderVideo)}
              </div>
            ) : (
              <EmptyState icon={Video} label="No hay videos disponibles" />
            )}
          </TabsContent>

          <TabsContent value="youtube" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {activeYoutubeVideos.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeYoutubeVideos.map(renderYouTubeVideo)}
              </div>
            ) : (
              <EmptyState icon={Youtube} label="No hay videos de YouTube disponibles" />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
