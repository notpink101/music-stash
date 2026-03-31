export interface Album {
  id: string
  spotify_album_id: string | null  // null for manually added albums
  title: string
  artist: string
  cover_url: string | null  // null for manually added albums without a cover URL
  dominant_color: string | null
  genres: string[]
  average_score: number | null
  release_year: number | null
  created_at: string
  fav_k_track_id?: string | null
  fav_l_track_id?: string | null
  notes: string | null
}

export interface Track {
  id: string
  album_id: string
  spotify_track_id: string | null  // null for manually added tracks
  title: string
  track_number: number
  duration_ms: number
  rating: number | null
  is_interlude?: boolean
}
