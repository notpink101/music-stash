import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as ManualAlbumBody

  if (!b.title?.trim() || !b.artist?.trim()) {
    return NextResponse.json({ error: 'title and artist are required' }, { status: 400 })
  }
  if (!Array.isArray(b.tracks) || b.tracks.length === 0) {
    return NextResponse.json({ error: 'At least one track is required' }, { status: 400 })
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({
      spotify_album_id: null,
      title: b.title.trim(),
      artist: b.artist.trim(),
      cover_url: b.cover_url?.trim() || null,
      dominant_color: null,
      genres: b.genres ?? [],
      release_year: b.release_year ?? null,
    })
    .select()
    .single()

  if (albumError || !album) {
    console.error('[/api/import-manual] Album insert error', albumError)
    return NextResponse.json({ error: 'Failed to save album' }, { status: 500 })
  }

  const trackRows = b.tracks.map((t) => ({
    album_id: album.id,
    spotify_track_id: null,
    title: t.title.trim(),
    track_number: t.track_number,
    duration_ms: 0,
  }))

  const { data: tracks, error: tracksError } = await supabase
    .from('tracks')
    .insert(trackRows)
    .select()

  if (tracksError) {
    console.error('[/api/import-manual] Tracks insert error', tracksError)
    await supabase.from('albums').delete().eq('id', album.id)
    return NextResponse.json({ error: 'Failed to save tracks' }, { status: 500 })
  }

  return NextResponse.json({ ...album, tracks }, { status: 201 })
}
