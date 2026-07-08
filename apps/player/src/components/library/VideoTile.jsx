import { Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function formatDuration(seconds) {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoTile({ video, onSelect, style, className }) {
  const hasThumb = Boolean(video.thumbnail);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(video)}
      style={style}
      className={cn(
        'group cinema-fade-up flex w-full flex-col gap-3 text-left outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
        {hasThumb ? (
          <img
            src={`/api/stream/${video.thumbnail}`}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(145deg,oklch(0.24_0.03_55),oklch(0.14_0.01_55))]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-95" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
            <Play className="size-3 fill-current" />
            {formatDuration(video.duration)}
          </span>
        </div>
      </div>

      <div className="space-y-2 px-0.5">
        <div className="line-clamp-2 text-base font-medium leading-snug tracking-tight transition-colors group-hover:text-primary">
          {video.title}
        </div>
        {(video.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(video.tags || []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
