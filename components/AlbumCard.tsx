import Image from 'next/image'
import Link from 'next/link'
import { Music } from 'lucide-react'
import type { Album } from '@/lib/types'

interface AlbumCardProps {
  album: Album
  index?: number
}

export default function AlbumCard({ album, index = 0 }: AlbumCardProps) {
  return (
    <Link
      href={`/album/${album.id}`}
      className="group block animate-slide-up"
      style={{ animationDelay: `${index * 35}ms` }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95">
        {album.cover_url ? (
          <Image
            src={album.cover_url}
            alt={`${album.title} cover`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 34vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800">
            <Music size={24} className="text-zinc-600" />
          </div>
        )}

        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Score badge */}
        {album.average_score !== null && (
          <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="text-[11px] font-black tabular-nums text-white">
              {album.average_score.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <p className="truncate text-xs font-semibold leading-tight">{album.title}</p>
        <p className="truncate text-[11px] text-zinc-500">{album.artist}</p>
      </div>
    </Link>
  )
}
