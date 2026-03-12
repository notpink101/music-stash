'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import TrackRow from '@/components/TrackRow'
import type { Album, Track } from '@/lib/types'

interface Props {
  album: Album
  initialTracks: Track[]
}

function computeAverage(tracks: Track[]): number | null {
  const rated = tracks.filter((t) => t.rating !== null)
  if (!rated.length) return null
  return rated.reduce((sum, t) => sum + t.rating!, 0) / rated.length
}

export default function AlbumPageClient({ album, initialTracks }: Props) {
  const router = useRouter()
  const [tracks, setTracks] = useState(initialTracks)
  const [averageScore, setAverageScore] = useState(album.average_score)
  const [accent, setAccent] = useState(album.dominant_color ?? '#6366f1')

  // ── Client-side color extraction (runs once if dominant_color not yet saved) ─
  useEffect(() => {
    if (album.dominant_color || !album.cover_url) return // already have it or no cover

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = album.cover_url
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        setAccent(hex)
        await supabase.from('albums').update({ dominant_color: hex }).eq('id', album.id)
      } catch {
        // non-fatal — fallback accent stays
      }
    }
  }, [album.id, album.cover_url, album.dominant_color])

  // ── Realtime: sync ratings from other squad members ────────────────────────
  // Requires: Supabase dashboard → Realtime → enable for `tracks` table
  useEffect(() => {
    const channel = supabase
      .channel(`album-${album.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tracks',
          filter: `album_id=eq.${album.id}`,
        },
        (payload) => {
          setTracks((prev) => {
            const next = prev.map((t) =>
              t.id === (payload.new as Track).id ? { ...t, ...(payload.new as Track) } : t
            )
            setAverageScore(computeAverage(next))
            return next
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [album.id])

  // ── Rating ─────────────────────────────────────────────────────────────────
  const rateTrack = useCallback(
    async (trackId: string, rating: number) => {
      // Optimistic update
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === trackId ? { ...t, rating } : t))
        setAverageScore(computeAverage(next))
        return next
      })

      // Persist + recompute stored average
      await supabase.from('tracks').update({ rating }).eq('id', trackId)
      await supabase.rpc('recompute_album_average', { p_album_id: album.id })
    },
    [album.id]
  )

  // ── Styles ─────────────────────────────────────────────────────────────────
  const gradient = `linear-gradient(to bottom, ${accent}cc 0%, ${accent}44 30%, #09090b 60%)`

  return (
    <div className="min-h-screen bg-zinc-950" style={{ background: gradient }}>
      {/* Back button */}
      <div className="sticky top-0 z-10 px-3 pt-safe">
        <button
          onClick={() => router.back()}
          className="mt-2 flex items-center gap-0.5 rounded-xl px-2.5 py-2 text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95 active:bg-white/15"
          aria-label="Go back"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      <div className="px-4 pb-32">
        {/* Cover art */}
        <div className="flex justify-center pb-5 animate-scale-in">
          <div
            className="relative h-52 w-52 overflow-hidden rounded-2xl sm:h-64 sm:w-64"
            style={{ boxShadow: `0 24px 64px ${accent}55, 0 8px 24px rgba(0,0,0,0.6)` }}
          >
            {album.cover_url ? (
              <Image
                src={album.cover_url}
                alt={album.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 640px) 208px, 256px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                <span className="text-5xl font-black text-zinc-600">
                  {album.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '80ms' }}>
          <h1 className="text-2xl font-bold leading-tight">{album.title}</h1>
          <p className="mt-1 text-zinc-300">{album.artist}</p>
          {album.release_year && <p className="text-sm text-zinc-500">{album.release_year}</p>}

          {/* Genre pills */}
          {album.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {album.genres.slice(0, 5).map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[11px] capitalize text-zinc-400"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Average score */}
          <div className="mt-5 flex items-baseline gap-1.5">
            {averageScore !== null ? (
              <>
                <span
                  className="text-6xl font-black tabular-nums leading-none"
                  style={{ color: accent, textShadow: `0 0 48px ${accent}80` }}
                >
                  {averageScore.toFixed(1)}
                </span>
                <span className="mb-1 text-lg font-medium text-zinc-500">/10</span>
              </>
            ) : (
              <span className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-zinc-500">
                Not rated yet
              </span>
            )}
          </div>
        </div>

        {/* Track list */}
        <div
          className="mt-8 rounded-2xl bg-black/30 px-4 backdrop-blur-sm animate-slide-up"
          style={{ animationDelay: '160ms' }}
        >
          {tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              accentColor={accent}
              index={i}
              onRate={rateTrack}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
