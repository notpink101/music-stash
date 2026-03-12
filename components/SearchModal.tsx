'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { X, Search, Loader2, Plus, Trash2 } from 'lucide-react'
import type { SpotifyAlbumResult } from '@/lib/spotify'
import type { Album } from '@/lib/types'

interface Props {
  onClose: () => void
  onImported: (album: Album) => void
}

type Mode = 'spotify' | 'manual'

export default function SearchModal({ onClose, onImported }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('spotify')

  // ── Spotify search state ───────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyAlbumResult[]>([])
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Manual entry state ─────────────────────────────────────────────────────
  const [manualTitle, setManualTitle] = useState('')
  const [manualArtist, setManualArtist] = useState('')
  const [manualYear, setManualYear] = useState('')
  const [manualCover, setManualCover] = useState('')
  const [manualGenres, setManualGenres] = useState('')
  const [manualTracks, setManualTracks] = useState([{ title: '' }])
  const [manualSubmitting, setManualSubmitting] = useState(false)

  useEffect(() => {
    if (mode === 'spotify') inputRef.current?.focus()
  }, [mode])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [query])

  async function handleSelect(spotifyAlbumId: string) {
    setImporting(spotifyAlbumId)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyAlbumId }),
      })
      const album: Album = await res.json()
      onImported(album)
      router.push(`/album/${album.id}`)
    } finally {
      setImporting(null)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validTracks = manualTracks.filter((t) => t.title.trim())
    if (!manualTitle.trim() || !manualArtist.trim() || validTracks.length === 0) return

    setManualSubmitting(true)
    try {
      const res = await fetch('/api/import-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle,
          artist: manualArtist,
          release_year: manualYear ? Number(manualYear) : null,
          cover_url: manualCover || null,
          genres: manualGenres
            ? manualGenres.split(',').map((g) => g.trim()).filter(Boolean)
            : [],
          tracks: validTracks.map((t, i) => ({ title: t.title, track_number: i + 1 })),
        }),
      })
      const album: Album = await res.json()
      onImported(album)
      router.push(`/album/${album.id}`)
    } finally {
      setManualSubmitting(false)
    }
  }

  function addTrack() {
    setManualTracks((prev) => [...prev, { title: '' }])
  }

  function removeTrack(i: number) {
    setManualTracks((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateTrack(i: number, title: string) {
    setManualTracks((prev) => prev.map((t, idx) => (idx === i ? { title } : t)))
  }

  const manualValid =
    manualTitle.trim() && manualArtist.trim() && manualTracks.some((t) => t.title.trim())

  const inputClass =
    'w-full rounded-xl bg-white/8 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-white/20 transition-shadow'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-safe animate-slide-in-bottom">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        {mode === 'spotify' ? (
          <>
            <Search size={18} className="shrink-0 text-zinc-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Artist or album..."
              className="flex-1 bg-transparent text-base text-white placeholder-zinc-500 outline-none"
            />
            {searching ? (
              <Loader2 size={18} className="shrink-0 animate-spin text-zinc-500" />
            ) : (
              <button onClick={onClose} aria-label="Close">
                <X size={20} className="text-zinc-400" />
              </button>
            )}
          </>
        ) : (
          <>
            <span className="flex-1 text-base font-semibold">Add Manually</span>
            <button onClick={onClose} aria-label="Close">
              <X size={20} className="text-zinc-400" />
            </button>
          </>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 border-b border-white/5 px-4 py-3">
        {(['spotify', 'manual'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              mode === m ? 'bg-white text-black' : 'bg-white/10 text-zinc-400'
            }`}
          >
            {m === 'spotify' ? 'Spotify' : 'Manual'}
          </button>
        ))}
      </div>

      {/* ── Spotify results ── */}
      {mode === 'spotify' && (
        <div className="flex-1 divide-y divide-white/5 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.spotify_album_id}
              onClick={() => handleSelect(r.spotify_album_id)}
              disabled={importing !== null}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/5 disabled:opacity-60"
            >
              {r.cover_url && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                  <Image src={r.cover_url} alt={r.title} fill className="object-cover" sizes="48px" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-zinc-400">
                  {r.artist} · {r.release_year}
                </p>
              </div>
              {importing === r.spotify_album_id && (
                <Loader2 size={16} className="shrink-0 animate-spin text-zinc-500" />
              )}
            </button>
          ))}

          {!searching && query.trim() && results.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">No results found.</p>
          )}
        </div>
      )}

      {/* ── Manual entry form ── */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Required */}
            <div className="space-y-3">
              <input
                required
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Album title *"
                className={inputClass}
              />
              <input
                required
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                placeholder="Artist *"
                className={inputClass}
              />
            </div>

            {/* Optional */}
            <div className="space-y-3">
              <input
                type="number"
                min={1900}
                max={2100}
                value={manualYear}
                onChange={(e) => setManualYear(e.target.value)}
                placeholder="Release year (optional)"
                className={inputClass}
              />
              <input
                value={manualCover}
                onChange={(e) => setManualCover(e.target.value)}
                placeholder="Cover image URL (optional)"
                className={inputClass}
              />
              <input
                value={manualGenres}
                onChange={(e) => setManualGenres(e.target.value)}
                placeholder="Genres, comma separated (optional)"
                className={inputClass}
              />
            </div>

            {/* Tracklist */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Tracklist
              </p>
              <div className="space-y-2">
                {manualTracks.map((track, i) => (
                  <div key={i} className="flex items-center gap-2 animate-fade-in">
                    <span className="w-6 shrink-0 text-center text-xs tabular-nums text-zinc-500">
                      {i + 1}
                    </span>
                    <input
                      value={track.title}
                      onChange={(e) => updateTrack(i, e.target.value)}
                      placeholder={`Track ${i + 1}`}
                      className="flex-1 rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-white/20 transition-shadow"
                    />
                    {manualTracks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrack(i)}
                        className="shrink-0 text-zinc-600 transition-colors active:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTrack}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors active:text-white"
              >
                <Plus size={14} />
                Add track
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="shrink-0 border-t border-white/5 bg-zinc-950/90 px-4 pb-8 pt-3 backdrop-blur-sm">
            <button
              type="submit"
              disabled={!manualValid || manualSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-black transition-transform active:scale-95 disabled:opacity-40"
            >
              {manualSubmitting && <Loader2 size={16} className="animate-spin" />}
              Import Album
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
