'use client'

import { useState, useMemo, useRef } from 'react'
import { Search, Disc3, SlidersHorizontal, X, Plus } from 'lucide-react'
import AlbumCard from './AlbumCard'
import SearchModal from './SearchModal'
import type { Album } from '@/lib/types'

type SortKey = 'newest' | 'top'
type GridSize = 'sm' | 'md' | 'lg'

const GRID: Record<GridSize, string> = {
  sm: 'grid-cols-6 gap-1 px-2 sm:grid-cols-8',
  md: 'grid-cols-4 gap-1.5 px-2 sm:grid-cols-6',
  lg: 'grid-cols-3 gap-2 px-3 sm:grid-cols-4',
}

interface Props {
  initialAlbums: Album[]
}

export default function StashFeed({ initialAlbums }: Props) {
  const [albums, setAlbums] = useState(initialAlbums)
  const [sort, setSort] = useState<SortKey>('newest')
  const [gridSize, setGridSize] = useState<GridSize>('sm')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeGenres, setActiveGenres] = useState<string[]>([])
  const [activeArtists, setActiveArtists] = useState<string[]>([])
  const [libraryQuery, setLibraryQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const allGenres = useMemo(() => {
    const s = new Set<string>()
    albums.forEach((a) => a.genres.forEach((g) => s.add(g)))
    return [...s].sort()
  }, [albums])

  const allArtists = useMemo(() => {
    const s = new Set<string>()
    albums.forEach((a) => s.add(a.artist))
    return [...s].sort()
  }, [albums])

  const sorted = useMemo(() => {
    if (sort === 'top')
      return [...albums].sort((a, b) => (b.average_score ?? -1) - (a.average_score ?? -1))
    return albums
  }, [albums, sort])

  const filtered = useMemo(() => {
    let r = sorted
    if (libraryQuery.trim()) {
      const q = libraryQuery.trim().toLowerCase()
      r = r.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
    }
    if (activeGenres.length > 0)
      r = r.filter((a) => a.genres.some((g) => activeGenres.includes(g)))
    if (activeArtists.length > 0)
      r = r.filter((a) => activeArtists.includes(a.artist))
    return r
  }, [sorted, libraryQuery, activeGenres, activeArtists])

  const activeFilterCount = activeGenres.length + activeArtists.length

  function toggleGenre(g: string) {
    setActiveGenres((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))
  }
  function toggleArtist(a: string) {
    setActiveArtists((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))
  }
  function clearFilters() {
    setActiveGenres([])
    setActiveArtists([])
  }

  function onImported(album: Album) {
    setAlbums((prev) => [album, ...prev.filter((a) => a.id !== album.id)])
    setSearchOpen(false)
  }

  const pillBase = 'shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-150'
  const pillActive = 'bg-white text-black'
  const pillInactive = 'bg-white/8 text-zinc-400 hover:bg-white/15 hover:text-zinc-200'

  return (
    <>
      <div className="min-h-screen bg-zinc-950 pb-24 pb-safe">

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 overflow-visible border-b border-white/5 bg-zinc-950/80 backdrop-blur-md pt-safe">
          {/* Title row */}
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div className="flex items-center gap-2.5">
              <Disc3 size={18} className="text-zinc-400" />
              <div>
                <h1 className="text-base font-bold leading-none tracking-tight">The Stash</h1>
                {albums.length > 0 && (
                  <p className="mt-0.5 text-[10px] leading-none text-zinc-500">
                    {albums.length} {albums.length === 1 ? 'album' : 'albums'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-all duration-150 hover:scale-110 hover:bg-zinc-100 active:scale-95"
              aria-label="Add album"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
          {/* Library search bar */}
          <div className="relative mx-4 mb-3">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchInputRef}
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              placeholder="Search your stash..."
              className="w-full rounded-full bg-white/8 py-2.5 pl-9 pr-9 text-sm text-white placeholder-zinc-500 outline-none focus:bg-white/10 transition-colors"
            />
            {libraryQuery && (
              <button
                onClick={() => { setLibraryQuery(''); searchInputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </header>

        {/* ── Controls: sort + filter + size ──────────────────── */}
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          {/* Left: sort + filter */}
          <div className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-none">
            {(['newest', 'top'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`${pillBase} ${sort === key ? pillActive : pillInactive}`}
              >
                {key === 'newest' ? 'Newest' : 'Top Rated'}
              </button>
            ))}

            <button
              onClick={() => setFilterOpen((p) => !p)}
              className={`${pillBase} flex items-center gap-1.5 ${
                filterOpen || activeFilterCount > 0 ? pillActive : pillInactive
              }`}
            >
              <SlidersHorizontal size={11} />
              Filter
              {activeFilterCount > 0 && (
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black ${
                    filterOpen ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Right: size toggle */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/8 p-0.5">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setGridSize(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-150 ${
                  gridSize === s ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filter panel ────────────────────────────────────── */}
        {filterOpen && (
          <div className="border-b border-white/5 px-3 pb-3 pt-1 animate-slide-up">
            {allGenres.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  Genre
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {allGenres.map((g) => (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`${pillBase} capitalize ${activeGenres.includes(g) ? pillActive : pillInactive}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allArtists.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  Artist
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {allArtists.map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleArtist(a)}
                      className={`${pillBase} ${activeArtists.includes(a) ? pillActive : pillInactive}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-white"
              >
                <X size={11} />
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* ── Active filter chips (panel closed) ──────────────── */}
        {!filterOpen && activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-none animate-fade-in">
            {[
              ...activeGenres.map((g) => ({ label: g, remove: () => toggleGenre(g) })),
              ...activeArtists.map((a) => ({ label: a, remove: () => toggleArtist(a) })),
            ].map(({ label, remove }) => (
              <button
                key={label}
                onClick={remove}
                className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/20"
              >
                {label}
                <X size={9} className="text-zinc-500" />
              </button>
            ))}
            <button
              onClick={clearFilters}
              className="ml-0.5 shrink-0 text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Grid / empty states ──────────────────────────────── */}
        {albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 pt-32">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
              <Disc3 size={28} className="text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">Nothing in the stash yet.</p>
              <p className="mt-0.5 text-xs text-zinc-600">Add an album to get started.</p>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="mt-1 rounded-full bg-white px-5 py-2 text-xs font-bold text-black transition-all duration-150 hover:scale-105 hover:bg-zinc-100 active:scale-95"
            >
              Add first album
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-24">
            <p className="text-sm text-zinc-500">
              {libraryQuery.trim() ? `No albums matching "${libraryQuery}"` : 'No albums match your filters.'}
            </p>
            <button
              onClick={() => { setLibraryQuery(''); clearFilters() }}
              className="text-xs text-zinc-400 underline transition-colors hover:text-white"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className={`grid pt-1 ${GRID[gridSize]}`}>
            {filtered.map((album, i) => (
              <AlbumCard key={album.id} album={album} index={i} />
            ))}
          </div>
        )}
      </div>

      {searchOpen && (
        <SearchModal onClose={() => setSearchOpen(false)} onImported={onImported} />
      )}
    </>
  )
}
