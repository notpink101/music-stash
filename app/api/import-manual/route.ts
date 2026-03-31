import { NextRequest, NextResponse } from 'next/server'
import { importAlbum } from '@/lib/importAlbum'

interface ManualTrack {
  title: string
  track_number: number
}

interface ManualAlbumBody {
  title: string
  artist: string
  release_year?: number | null
  cover_url?: string | null
  genres?: string[]
  tracks: ManualTrack[]
}

/** Strip HTML/script tags from a string. */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

/** Validate that a string is a well-formed http/https URL. */
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const b = body as ManualAlbumBody

  // --- title & artist ---
  if (!b.title?.trim() || !b.artist?.trim()) {
    return NextResponse.json({ error: 'title and artist are required' }, { status: 400 })
  }

  const title = stripHtml(b.title.trim())
  const artist = stripHtml(b.artist.trim())

  if (!title || !artist) {
    return NextResponse.json({ error: 'title and artist must not be empty after sanitization' }, { status: 400 })
  }

  // --- cover_url ---
  let coverUrl: string | null = null
  if (b.cover_url != null && b.cover_url.trim() !== '') {
    const trimmed = b.cover_url.trim()
    if (!isValidHttpUrl(trimmed)) {
      return NextResponse.json({ error: 'cover_url must be a valid http or https URL' }, { status: 400 })
    }
    coverUrl = trimmed
  }

  // --- release_year ---
  if (b.release_year != null) {
    const year = Number(b.release_year)
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return NextResponse.json({ error: 'release_year must be an integer between 1900 and 2100' }, { status: 400 })
    }
  }

  // --- genres ---
  let sanitizedGenres: string[] = []
  if (b.genres != null) {
    if (!Array.isArray(b.genres)) {
      return NextResponse.json({ error: 'genres must be an array' }, { status: 400 })
    }
    if (b.genres.length > 20) {
      return NextResponse.json({ error: 'genres may contain at most 20 entries' }, { status: 400 })
    }
    if (b.genres.some((g) => typeof g !== 'string')) {
      return NextResponse.json({ error: 'each genre must be a string' }, { status: 400 })
    }
    sanitizedGenres = (b.genres as string[]).map(g => stripHtml(g).trim()).filter(g => g.length > 0)
  }

  // --- tracks ---
  if (!Array.isArray(b.tracks) || b.tracks.length === 0) {
    return NextResponse.json({ error: 'At least one track is required' }, { status: 400 })
  }

  for (let i = 0; i < b.tracks.length; i++) {
    const t = b.tracks[i]
    if (typeof t.title !== 'string' || stripHtml(t.title).trim() === '') {
      return NextResponse.json(
        { error: `Track at index ${i} must have a non-empty title` },
        { status: 400 }
      )
    }
  }

  const result = await importAlbum({
    spotify_album_id: null,
    title,
    artist,
    cover_url: coverUrl,
    genres: sanitizedGenres,
    release_year: b.release_year ?? null,
    tracks: b.tracks.map((t) => ({
      spotify_track_id: null,
      title: stripHtml(t.title).trim(),
      track_number: t.track_number,
      duration_ms: 0,
    })),
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.album, { status: 201 })
}
