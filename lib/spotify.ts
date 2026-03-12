/**
 * Spotify Web API — Client Credentials flow.
 * All functions are server-only (no "use client" — never import from a Client Component).
 * The access token is cached in module scope for the lifetime of the server process.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpotifyAlbumResult {
  spotify_album_id: string
  title: string
  artist: string
  cover_url: string
  release_year: number
  genres: string[]
}

export interface SpotifyTrackResult {
  spotify_track_id: string
  title: string
  track_number: number
  duration_ms: number
}

export interface SpotifyAlbumDetail extends SpotifyAlbumResult {
  tracks: SpotifyTrackResult[]
}

// ─── Token cache (module-scoped, server only) ─────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET env vars')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  // Expire 60 s early to avoid edge-case expiry mid-request
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }

  return tokenCache.token
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function spotifyFetch(path: string): Promise<Response> {
  const token = await getAccessToken()
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 }, // cache Spotify responses for 1 h on the server
  })
}

/** Pick the highest-resolution image from a Spotify images array. */
function bestImage(images: Array<{ url: string; width: number; height: number }>): string {
  if (!images?.length) return ''
  return images.reduce((best, img) => (img.width > best.width ? img : best), images[0]).url
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search Spotify for albums matching `query`.
 * Returns up to 10 results shaped for the search results UI.
 */
export async function searchAlbums(query: string): Promise<SpotifyAlbumResult[]> {
  const res = await spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=album&limit=10`
  )

  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`)

  const data = await res.json()
  const items: SpotifyRawAlbum[] = data.albums?.items ?? []

  return items
    .filter((item) => item != null)
    .map((item) => ({
      spotify_album_id: item.id,
      title: item.name,
      artist: item.artists[0]?.name ?? 'Unknown Artist',
      cover_url: bestImage(item.images),
      release_year: new Date(item.release_date).getFullYear(),
      // Basic search results don't include genres — fetched in getAlbumDetail
      genres: [],
    }))
}

/**
 * Fetch full album details + complete ordered tracklist from Spotify.
 * Handles albums with >20 tracks by paginating the tracks endpoint.
 */
export async function getAlbumDetail(spotifyAlbumId: string): Promise<SpotifyAlbumDetail> {
  const res = await spotifyFetch(`/albums/${spotifyAlbumId}`)
  if (!res.ok) throw new Error(`Spotify album fetch failed: ${res.status}`)

  const album: SpotifyRawAlbumFull = await res.json()

  // Collect all track pages
  let trackItems: SpotifyRawTrack[] = album.tracks.items
  let next: string | null = album.tracks.next

  while (next) {
    // `next` is an absolute URL — strip the base so spotifyFetch can prefix it
    const path = next.replace('https://api.spotify.com/v1', '')
    const pageRes = await spotifyFetch(path)
    if (!pageRes.ok) break
    const page = await pageRes.json()
    trackItems = trackItems.concat(page.items)
    next = page.next
  }

  // Spotify album-level genres can be empty; fall back to artist genres
  let genres: string[] = album.genres ?? []
  if (genres.length === 0 && album.artists[0]?.id) {
    genres = await getArtistGenres(album.artists[0].id)
  }

  return {
    spotify_album_id: album.id,
    title: album.name,
    artist: album.artists[0]?.name ?? 'Unknown Artist',
    cover_url: bestImage(album.images),
    release_year: new Date(album.release_date).getFullYear(),
    genres,
    tracks: trackItems
      .filter((t) => t != null)
      .map((t) => ({
        spotify_track_id: t.id,
        title: t.name,
        track_number: t.track_number,
        duration_ms: t.duration_ms,
      })),
  }
}

/** Fetch genres from the artist endpoint (album genres are often empty). */
async function getArtistGenres(artistId: string): Promise<string[]> {
  const res = await spotifyFetch(`/artists/${artistId}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.genres ?? []
}

// ─── Raw Spotify shapes (internal only) ──────────────────────────────────────

interface SpotifyRawAlbum {
  id: string
  name: string
  artists: Array<{ id: string; name: string }>
  images: Array<{ url: string; width: number; height: number }>
  release_date: string
}

interface SpotifyRawTrack {
  id: string
  name: string
  track_number: number
  duration_ms: number
}

interface SpotifyRawAlbumFull extends SpotifyRawAlbum {
  genres: string[]
  tracks: {
    items: SpotifyRawTrack[]
    next: string | null
  }
}
