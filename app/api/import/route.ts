import { NextRequest, NextResponse } from 'next/server'
import { getAlbumDetail } from '@/lib/spotify'
import { supabase } from '@/lib/supabase'

// dominant_color is extracted client-side via colorthief after import and saved back via Supabase

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const spotifyAlbumId = (body as Record<string, unknown>)?.spotifyAlbumId
  if (typeof spotifyAlbumId !== 'string' || !spotifyAlbumId.trim()) {
    return NextResponse.json({ error: 'Missing field: spotifyAlbumId' }, { status: 400 })
  }

  // ── Check for existing import ──────────────────────────────────────────────
  const { data: existing, error: lookupError } = await supabase
    .from('albums')
    .select('*, tracks(*)')
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

  // ── Insert album ───────────────────────────────────────────────────────────
  // dominant_color left null here — extracted client-side on first album page visit
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({
      spotify_album_id: albumDetail.spotify_album_id,
      title: albumDetail.title,
      artist: albumDetail.artist,
      cover_url: albumDetail.cover_url,
      dominant_color: null,
      genres: albumDetail.genres,
      release_year: albumDetail.release_year,
    })
    .select()
    .single()

  if (albumError || !album) {
    console.error('[/api/import] Album insert error', albumError)
    return NextResponse.json({ error: 'Failed to save album' }, { status: 500 })
  }

  // ── Insert tracks ──────────────────────────────────────────────────────────
  const trackRows = albumDetail.tracks.map((t) => ({
    album_id: album.id,
    spotify_track_id: t.spotify_track_id,
    title: t.title,
    track_number: t.track_number,
    duration_ms: t.duration_ms,
  }))

  const { data: tracks, error: tracksError } = await supabase
    .from('tracks')
    .insert(trackRows)
    .select()

  if (tracksError) {
    console.error('[/api/import] Tracks insert error', tracksError)
    // Album was created — don't leave it orphaned; attempt cleanup
    await supabase.from('albums').delete().eq('id', album.id)
    return NextResponse.json({ error: 'Failed to save tracks' }, { status: 500 })
  }

  return NextResponse.json({ ...album, tracks }, { status: 201 })
}
