'use client'

import { useState, useEffect, useRef } from 'react'
import type { Track } from '@/lib/types'

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ratingColor(r: number | null): string {
  if (r === null) return 'text-zinc-600'
  if (r >= 8) return 'text-emerald-400'
  if (r >= 6) return 'text-amber-400'
  if (r >= 4) return 'text-orange-400'
  return 'text-red-400'
}

interface TrackRowProps {
  track: Track
  accentColor?: string
  index?: number
  onRate: (trackId: string, rating: number) => void
}

export default function TrackRow({ track, accentColor = '#6366f1', index = 0, onRate }: TrackRowProps) {
  const [localRating, setLocalRating] = useState<number | null>(track.rating)
  const isDragging = useRef(false)

  useEffect(() => {
    if (!isDragging.current) {
      setLocalRating(track.rating)
    }
  }, [track.rating])

  return (
    <div
      className="-mx-4 flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0 animate-fade-in transition-colors hover:bg-white/[0.04]"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Track number */}
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-zinc-600">
        {track.track_number}
      </span>

      {/* Title + duration */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium leading-tight transition-colors ${localRating !== null ? 'text-white' : 'text-zinc-300'}`}>
          {track.title}
        </p>
        {track.duration_ms > 0 && (
          <p className="text-[11px] text-zinc-600">{formatDuration(track.duration_ms)}</p>
        )}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={localRating ?? 5}
        onChange={(e) => setLocalRating(Number(e.target.value))}
        onPointerDown={() => { isDragging.current = true }}
        onPointerUp={(e) => {
          isDragging.current = false
          const v = Number((e.target as HTMLInputElement).value)
          setLocalRating(v)
          onRate(track.id, v)
        }}
        style={{ accentColor }}
        className="w-20 shrink-0 cursor-pointer"
      />

      {/* Rating badge */}
      <span
        className={`w-7 shrink-0 text-right text-sm font-black tabular-nums transition-colors ${ratingColor(localRating)}`}
      >
        {localRating !== null ? localRating : '—'}
      </span>
    </div>
  )
}
