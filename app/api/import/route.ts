import { NextRequest, NextResponse } from 'next/server'
import { getAlbumDetail } from '@/lib/spotify'
import { supabase } from '@/lib/supabase'
import { importAlbum } from '@/lib/importAlbum'

// dominant_color is extracted client-side via colorthief after import and saved back via Supabase

// ─── Request body types ────────────────────────────────────────────────────────

interface ImportBody {
  spotifyAlbumId: string
}

function isImportBody(body: unknown): body is ImportBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ImportBody).spotifyAlbumId === 'string' &&
    (body as ImportBody).spotifyAlbumId.trim() !== ''
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isImportBody(body)) {
    return NextResponse.json({ error: 'Missing field: spotifyAlbumId' }, { status: 400 })
  }

  const spotifyAlbumId = body.spotifyAlbumId

  // ── Check for existing import ──────────────────────────────────────────────
  const { data: existing, error: lookupError } = await supabase
    .from('albums')
    .select('*, tracks!tracks_album_id_fkey(*)')
    .eq('spotify_album_id', spotifyAlbumId)
    .maybeSingle()

  if (lookupError) {
    console.error('[/api/import] Supabase lookup error', lookupError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json(existing)
  }

  // ── Fetch from Spotify ─────────────────────────────────────────────────────
  let albumDetail: Awaited<ReturnType<typeof getAlbumDetail>>
  try {
    albumDetail = await getAlbumDetail(spotifyAlbumId)
  } catch (err) {
    console.error('[/api/import] Spotify fetch error', err)
    return NextResponse.json({ error: 'Failed to fetch album from Spotify' }, { status: 502 })
  }

  // ── Insert album + tracks via shared helper ────────────────────────────────
  const result = await importAlbum({
    spotify_album_id: albumDetail.spotify_album_id,
    title: albumDetail.title,
    artist: albumDetail.artist,
    cover_url: albumDetail.cover_url,
    genres: albumDetail.genres,
    release_year: albumDetail.release_year,
    tracks: albumDetail.tracks.map((t) => ({
      spotify_track_id: t.spotify_track_id,
      title: t.title,
      track_number: t.track_number,
      duration_ms: t.duration_ms,
    })),
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.album, { status: 201 })
}
