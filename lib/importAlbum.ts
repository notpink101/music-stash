import { supabase } from './supabase'
import type { Album, Track } from './types'

export interface ImportAlbumInput {
  spotify_album_id: string | null
  title: string
  artist: string
  cover_url: string | null
  genres: string[]
  release_year: number | null
  tracks: Array<{
    spotify_track_id: string | null
    title: string
    track_number: number
    duration_ms: number
  }>
}

export type ImportResult =
  | { success: true; album: Album & { tracks: Track[] } }
  | { success: false; error: string; status: number }

/**
 * Insert an album row and its tracks into Supabase.
 *
 * If the track insert fails, the newly created album row is deleted to avoid
 * leaving orphaned albums. Note: this is best-effort, not atomic — a true
 * transaction would require a Supabase RPC.
 */
export async function importAlbum(input: ImportAlbumInput): Promise<ImportResult> {
  // ── Insert album ─────────────────────────────────────────────────────────────
  // dominant_color is left null here — extracted client-side on first album page visit
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({
      spotify_album_id: input.spotify_album_id,
      title: input.title,
      artist: input.artist,
      cover_url: input.cover_url,
      dominant_color: null,
      genres: input.genres,
      release_year: input.release_year,
    })
    .select()
    .single()

  if (albumError || !album) {
    console.error('[importAlbum] Album insert error', albumError)
    return { success: false, error: 'Failed to save album', status: 500 }
  }

  // ── Insert tracks ─────────────────────────────────────────────────────────────
  const trackRows = input.tracks.map((t) => ({
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
    console.error('[importAlbum] Tracks insert error', tracksError)
    // Album was created — attempt cleanup to avoid orphaned rows
    const { error: cleanupError } = await supabase
      .from('albums')
      .delete()
      .eq('id', album.id)
    if (cleanupError) {
      console.error('[importAlbum] Album cleanup error after tracks failure', cleanupError)
    }
    return { success: false, error: 'Failed to save tracks', status: 500 }
  }

  return { success: true, album: { ...album, tracks: tracks ?? [] } }
}
