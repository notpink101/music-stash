'use client'

import { useState, useEffect, useRef } from 'react'
import { Ban } from 'lucide-react'
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
  onInterlude: (trackId: string, isInterlude: boolean) => void
}

export default function TrackRow({ track, accentColor = '#6366f1', index = 0, onRate, onInterlude }: TrackRowProps) {
  const [localRating, setLocalRating] = useState<number | null>(track.rating)
  const [isInterlude, setIsInterlude] = useState(track.is_interlude)
  const isDragging = useRef(false)

  useEffect(() => {
    if (!isDragging.current) setLocalRating(track.rating)
  }, [track.rating])

  useEffect(() => {
    setIsInterlude(track.is_interlude)
  }, [track.is_interlude])

  function toggleInterlude() {
    const next = !isInterlude
    setIsInterlude(next)
    onInterlude(track.id, next)
  }

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
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm font-medium leading-tight transition-colors ${isInterlude ? 'text-zinc-500' : localRating !== null ? 'text-white' : 'text-zinc-300'}`}>
            {track.title}
          </p>
          {isInterlude && (
            <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
              interlude
            </span>
          )}
        </div>
        {track.duration_ms > 0 && (
          <p className="text-[11px] text-zinc-600">{formatDuration(track.duration_ms)}</p>
        )}
      </div>

      {/* Slider or interlude placeholder */}
      {isInterlude ? (
        <span className="w-20 shrink-0 text-center text-xs text-zinc-600">no rating</span>
      ) : (
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
      )}

      {/* Rating badge */}
      <span
        className={`w-7 shrink-0 text-right text-sm font-black tabular-nums transition-colors ${isInterlude ? 'text-zinc-700' : ratingColor(localRating)}`}
      >
        {isInterlude ? '—' : localRating !== null ? localRating : '—'}
      </span>

      {/* Interlude toggle */}
      <button
        onClick={toggleInterlude}
        className={`shrink-0 rounded-full p-1 transition-colors ${isInterlude ? 'text-zinc-400' : 'text-zinc-700 hover:text-zinc-500'}`}
        aria-label={isInterlude ? 'Remove interlude' : 'Mark as interlude'}
        title={isInterlude ? 'Remove interlude' : 'Mark as interlude (excluded from score)'}
      >
        <Ban size={13} />
      </button>
    </div>
  )
}
