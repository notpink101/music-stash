'use client'

import { useState, useEffect, useRef } from 'react'
import { Ban, X } from 'lucide-react'
import { RATING_THRESHOLDS, DEFAULT_ACCENT_COLOR } from '@/lib/constants'
import type { Track } from '@/lib/types'

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ratingColor(r: number | null): string {
  if (r === null) return 'text-zinc-600'
  if (r >= RATING_THRESHOLDS.GREAT) return 'text-emerald-400'
  if (r >= RATING_THRESHOLDS.GOOD) return 'text-amber-400'
  if (r >= RATING_THRESHOLDS.OKAY) return 'text-orange-400'
  return 'text-red-400'
}

interface TrackRowProps {
  track: Track
  accentColor?: string
  index?: number
  onRate: (trackId: string, rating: number) => void
  onInterlude: (trackId: string, isInterlude: boolean) => void
  isFavK: boolean
  isFavL: boolean
  onFavK: (trackId: string | null) => void
  onFavL: (trackId: string | null) => void
}

export default function TrackRow({ track, accentColor = DEFAULT_ACCENT_COLOR, index = 0, onRate, onInterlude, isFavK, isFavL, onFavK, onFavL }: TrackRowProps) {
  const [localRating, setLocalRating] = useState<number | null>(track.rating)
  const [isInterlude, setIsInterlude] = useState(track.is_interlude ?? false)
  const [favMenuOpen, setFavMenuOpen] = useState(false)
  const isDragging = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDragging.current) setLocalRating(track.rating)
  }, [track.rating])

  useEffect(() => {
    setIsInterlude(track.is_interlude ?? false)
  }, [track.is_interlude])

  // Close menu on outside tap
  useEffect(() => {
    if (!favMenuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFavMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [favMenuOpen])

  function toggleInterlude() {
    const next = !isInterlude
    setIsInterlude(next)
    onInterlude(track.id, next)
  }

  // Row highlight based on fav
  const rowHighlight = isFavK
    ? 'bg-pink-300/10 border-l-2 border-pink-300/50'
    : isFavL
    ? 'bg-cyan-300/10 border-l-2 border-cyan-300/50'
    : 'border-l-2 border-transparent'

  return (
    <div
      className={`-mx-4 flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0 animate-fade-in transition-colors ${rowHighlight} ${!isFavK && !isFavL ? 'hover:bg-white/[0.04]' : ''}`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Track number */}
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-zinc-600">
        {track.track_number}
      </span>

      {/* Title + duration — tap to open fav menu */}
      <div ref={menuRef} className="relative min-w-0 flex-1">
        <button
          onClick={() => setFavMenuOpen((p) => !p)}
          className="w-full text-left"
        >
          <div className="flex items-center gap-1.5">
            <p className={`truncate text-sm font-medium leading-tight transition-colors ${isInterlude ? 'text-zinc-500' : localRating !== null ? 'text-white' : 'text-zinc-300'}`}>
              {track.title}
            </p>
            {isInterlude && (
              <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                interlude
              </span>
            )}
            {isFavK && (
              <span className="shrink-0 text-[10px] font-black text-pink-200">K</span>
            )}
            {isFavL && (
              <span className="shrink-0 text-[10px] font-black text-cyan-200">L</span>
            )}
          </div>
          {track.duration_ms > 0 && (
            <p className="text-[11px] text-zinc-600">{formatDuration(track.duration_ms)}</p>
          )}
        </button>

        {/* Fav picker — appears above the title area */}
        {favMenuOpen && (
          <div className="absolute bottom-full left-0 z-20 mb-1.5 flex items-center gap-1.5 rounded-full bg-zinc-800 px-2 py-1.5 shadow-xl ring-1 ring-white/10 animate-fade-in">
            <button
              onClick={() => { onFavK(isFavK ? null : track.id); setFavMenuOpen(false) }}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black transition-all ${
                isFavK ? 'bg-pink-200/30 text-pink-200 scale-110' : 'text-zinc-400 hover:bg-pink-200/15 hover:text-pink-200'
              }`}
            >K</button>
            <button
              onClick={() => { onFavL(isFavL ? null : track.id); setFavMenuOpen(false) }}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black transition-all ${
                isFavL ? 'bg-cyan-200/30 text-cyan-200 scale-110' : 'text-zinc-400 hover:bg-cyan-200/15 hover:text-cyan-200'
              }`}
            >L</button>
            {(isFavK || isFavL) && (
              <button
                onClick={() => { if (isFavK) onFavK(null); if (isFavL) onFavL(null); setFavMenuOpen(false) }}
                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>
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
