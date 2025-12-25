"use client";

import { Play, ExternalLink, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

export interface MediaEntity {
  type: "photo" | "video" | "animated_gif" | "link";
  media_url_https?: string; // For photos/video thumbnails
  url?: string; // The t.co link
  
  // For Videos
  video_info?: {
    variants:Array<{
      bitrate?: number;
      content_type: string;
      url: string;
    }>;
  };

  // For Links
  expanded_url?: string;
  display_url?: string;
}

interface TweetMediaProps {
  media: MediaEntity[] | null;
}

export function TweetMedia({ media }: TweetMediaProps) {
  if (!media || media.length === 0) return null;

  const photos = media.filter((m) => m.type === "photo");
  const video = media.find((m) => m.type === "video" || m.type === "animated_gif");
  const link = media.find((m) => m.type === "link");

  // --- 1. VIDEO RENDERER ---
  if (video) {
    const variant = video.video_info?.variants
      ?.filter((v) => v.content_type === "video/mp4")
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    // Fallback: If no MP4 (e.g. m3u8 only), try that, else just show thumbnail
    const src = variant?.url || video.video_info?.variants?.[0]?.url;

    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-white/10 bg-black">
        {src ? (
             <video
                controls
                preload="metadata"
                poster={video.media_url_https}
                className="w-full max-h-[400px] object-contain"
             >
                <source src={src} type={variant?.content_type || "application/x-mpegURL"} />
                Your browser does not support the video tag.
             </video>
        ) : (
            // Thumbnail only fallback
            <a href={video.url} target="_blank" className="relative block group">
                <img src={video.media_url_https} className="w-full opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-1" fill="currentColor"/>
                    </div>
                </div>
            </a>
        )}
      </div>
    );
  }

  // --- 2. PHOTO GRID RENDERER ---
  if (photos.length > 0) {
    return (
      <div className={`mt-3 grid gap-1 rounded-lg overflow-hidden border border-white/10 ${
        photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
      }`}>
        {photos.slice(0, 4).map((photo, idx) => (
           <LightboxImage 
                key={idx} 
                src={photo.media_url_https!} 
                className={`w-full h-full object-cover bg-white/5 hover:opacity-90 transition-opacity cursor-pointer ${photos.length === 1 ? 'max-h-[350px]' : 'aspect-square'}`} 
           />
        ))}
      </div>
    );
  }

  // --- 3. LINK CARD RENDERER (Article fallback) ---
  if (link && link.expanded_url) {
      const hostname = new URL(link.expanded_url).hostname.replace('www.', '');
      
      return (
        <a 
            href={link.expanded_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group"
        >
            <div className="h-10 w-10 shrink-0 rounded bg-blue-500/10 flex items-center justify-center text-blue-400">
                <FileText className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
                <div className="text-xs text-white/40 uppercase mb-0.5 flex items-center gap-1">
                    {hostname} <ExternalLink className="w-3 h-3" />
                </div>
                <div className="text-sm font-medium text-white/90 truncate w-full">
                    {link.expanded_url}
                </div>
            </div>
        </a>
      )
  }

  return null;
}

function LightboxImage({ src, className }: { src: string, className: string }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <img src={src} className={className} loading="lazy" />
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center">
                <VisuallyHidden>
                    <DialogTitle>Image preview</DialogTitle>
                </VisuallyHidden>
                <img src={src} className="max-w-full max-h-[90vh] rounded-md shadow-2xl" />
            </DialogContent>
        </Dialog>
    )
}