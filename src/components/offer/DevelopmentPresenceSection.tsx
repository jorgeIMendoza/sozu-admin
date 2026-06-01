import { Globe, Instagram, Facebook, Youtube, ExternalLink, Heart, Sparkles } from "lucide-react";
import type { DevelopmentInfo, InstagramPost, Agent } from "@/lib/offer-types";
import DevelopmentShowroomBlock from "./DevelopmentShowroomBlock";

interface Props {
  development: DevelopmentInfo;
  developmentName: string;
  agent?: Agent;
}

const SocialBadge = ({ href, icon: Icon, label, colorClass }: { href: string; icon: React.ElementType; label: string; colorClass: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border text-xs font-semibold transition-colors ${colorClass}`}>
    <Icon className="w-4 h-4" />
    {label}
  </a>
);

const InstagramPostCard = ({ post }: { post: InstagramPost }) => (
  <a href={post.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="relative block aspect-square rounded-xl overflow-hidden border border-border bg-muted group">
    <img src={post.imageUrl} alt={post.caption ?? "Post de Instagram"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-1.5">
      {post.likes !== undefined && (
        <div className="inline-flex items-center gap-1 text-white text-xs font-semibold">
          <Heart className="w-3.5 h-3.5 fill-white" />
          {post.likes.toLocaleString("es-MX")}
        </div>
      )}
      {post.caption && <p className="text-white text-[11px] leading-snug line-clamp-2">{post.caption}</p>}
    </div>
  </a>
);

const DevelopmentPresenceSection = ({ development, developmentName, agent }: Props) => {
  const { website, socials, instagramPosts, tagline, showroom } = development;
  const hasContent = website || socials || (instagramPosts && instagramPosts.length > 0) || showroom;
  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-6">
      <div>
        {development.logoUrl && (
          <div className="mb-4">
            <img src={development.logoUrl} alt={developmentName} className="h-9 md:h-11 w-auto object-contain dark:invert" />
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-lg md:text-xl font-bold">Conoce {developmentName}</h3>
        </div>
        {tagline && <p className="text-sm text-muted-foreground italic">"{tagline}"</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted/40 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Sitio web oficial</p>
              <p className="text-sm font-semibold text-foreground truncate">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </a>
        )}

        {socials && (socials.instagram || socials.facebook || socials.youtube) && (
          <div className="p-4 rounded-xl border border-border bg-background">
            <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-3">Síguenos en redes</p>
            <div className="flex flex-wrap gap-2">
              {socials.instagram && (
                <SocialBadge href={`https://www.instagram.com/${socials.instagram}/`} icon={Instagram} label={`@${socials.instagram}`} colorClass="text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30" />
              )}
              {socials.facebook && (
                <SocialBadge href={`https://www.facebook.com/${socials.facebook}`} icon={Facebook} label="Facebook" colorClass="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" />
              )}
              {socials.youtube && (
                <SocialBadge href={`https://www.youtube.com/${socials.youtube}`} icon={Youtube} label="YouTube" colorClass="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" />
              )}
            </div>
          </div>
        )}
      </div>

      {instagramPosts && instagramPosts.length > 0 && socials?.instagram && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-600 dark:text-pink-400" />
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Últimas publicaciones</p>
            </div>
            <a href={`https://www.instagram.com/${socials.instagram}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver más <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {instagramPosts.slice(0, 6).map((post) => (
              <InstagramPostCard key={post.id} post={post} />
            ))}
          </div>
          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              ¿Te gusta lo que ves?{" "}
              <a href={`https://www.instagram.com/${socials.instagram}/`} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:underline">
                Síguenos en @{socials.instagram}
              </a>
            </p>
          </div>
        </div>
      )}

      {showroom && <DevelopmentShowroomBlock showroom={showroom} developmentName={developmentName} agent={agent} />}
    </div>
  );
};

export default DevelopmentPresenceSection;
