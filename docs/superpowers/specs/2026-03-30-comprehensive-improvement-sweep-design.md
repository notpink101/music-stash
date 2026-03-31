# Comprehensive Improvement Sweep — Design Spec

## Overview

A five-wave improvement sweep for The Shared Music Stash PWA, progressing from security/data integrity through reactivity fixes, performance, UX polish, and new features. Each wave is independently shippable and leaves the app in a working state.

## Current Architecture

- **Frontend/Backend:** Next.js 16 (App Router), server + client components
- **Styling:** Tailwind CSS 4, dynamic accent colors from album art
- **Database:** Supabase (PostgreSQL) with realtime subscriptions
- **External Data:** Spotify Web API (Client Credentials flow)
- **PWA:** next-pwa with Workbox service worker

### Key Files

| File | Purpose |
|------|---------|
| `lib/spotify.ts` | Spotify API client (server-only) |
| `lib/supabase.ts` | Supabase client init |
| `lib/types.ts` | Album/Track TypeScript interfaces |
| `app/page.tsx` | Homepage server component |
| `app/album/[id]/page.tsx` | Album detail server component |
| `app/album/[id]/AlbumPageClient.tsx` | Album detail client view |
| `components/StashFeed.tsx` | Main library feed |
| `components/SearchModal.tsx` | Spotify search + manual add |
| `components/AlbumCard.tsx` | Album grid thumbnail |
| `components/TrackRow.tsx` | Track rating row |
| `app/api/import/route.ts` | Spotify album import endpoint |
| `app/api/import-manual/route.ts` | Manual album import endpoint |
| `app/api/search/route.ts` | Spotify search endpoint |

---

## Wave 1: Security & Data Integrity

### 1.1 Clean `.env.local.example`

**Problem:** `.env.local.example` contains real Spotify credentials and Supabase keys. Anyone cloning the repo gets working credentials.

**Fix:** Replace values with descriptive placeholders:
```
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SPOTIFY_CLIENT_ID="your-spotify-client-id"
SPOTIFY_CLIENT_SECRET="your-spotify-client-secret"
```

**Note:** The real `.env.local` file will NOT be touched.

**Post-cleanup:** After cleaning the example file, rotate the Spotify client secret in the Spotify Developer Dashboard and update `.env.local` with the new value. Evaluate whether Supabase keys need rotation (the anon key is designed to be public with RLS, but the exposure confirms the project ID and region).

### 1.2 Input Sanitization on Manual Album Form

**Problem:** `/api/import-manual` accepts arbitrary `cover_url` values with no validation. Text inputs aren't sanitized for HTML/script content.

**Fix in `app/api/import-manual/route.ts`:**
- Validate `cover_url` is a well-formed URL with `http://` or `https://` protocol using `URL` constructor
- Strip HTML tags from text inputs (title, artist, track titles) using a simple regex: `str.replace(/<[^>]*>/g, '')`
- Validate `release_year` is a reasonable number (1900-2100) if provided
- Validate `genres` array contains only strings, max 20 genres
- Validate each track has a non-empty title after trimming

### 1.3 Shared Import Helper with Cleanup

**Problem:** In both import routes, album insert and track insert are separate operations with ~60% duplicated code. If tracks fail, the code attempts to delete the album, but this cleanup could itself fail silently, leaving orphaned albums.

**Note:** True database transactions would require a Supabase RPC wrapping both inserts in `BEGIN`/`COMMIT`. The current approach (insert album, insert tracks, cleanup on failure) is best-effort — acceptable for this app's scale, but not atomic. If orphaned albums become an issue, a Supabase RPC can be added later.

**Fix:** Extract shared import logic into `lib/importAlbum.ts`:

```typescript
// lib/importAlbum.ts
interface ImportAlbumInput {
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

interface ImportResult {
  success: true
  album: Album & { tracks: Track[] }
} | {
  success: false
  error: string
  status: number
}
```

The function will:
1. Insert the album
2. Insert tracks
3. If track insert fails, delete the album and log both errors
4. Return a typed result object

Both `/api/import` and `/api/import-manual` will call this shared function, eliminating ~60% code duplication.

### 1.4 Database-Level Favorite Constraints

**Problem:** K/L favorite uniqueness is only enforced client-side. Concurrent requests could set multiple favorites.

**Fix:** The current schema uses `fav_k_track_id` and `fav_l_track_id` columns on the albums table (not a join table), so there's inherently only one value per album. The risk is a race condition where two concurrent updates both succeed. Mitigate by using Supabase's `.update()` which is atomic per row — the last write wins. This is acceptable behavior since favorites are non-critical data. No schema change needed.

---

## Wave 2: Reactivity & State Fixes

### 2.1 Library Refresh After Import

**Problem:** After importing an album and navigating back from the album detail page, the homepage doesn't show the new album until manual refresh. `StashFeed` only receives `initialAlbums` from the server component on first render.

**Fix:** Add a Supabase realtime subscription in `StashFeed.tsx` that listens for `INSERT` events on the `albums` table:

```typescript
// In StashFeed.tsx
useEffect(() => {
  const channel = supabase
    .channel('albums-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'albums' },
      (payload) => {
        setAlbums((prev) => [payload.new as Album, ...prev.filter(a => a.id !== (payload.new as Album).id)])
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'albums' },
      (payload) => {
        setAlbums((prev) => prev.filter(a => a.id !== (payload.old as Album).id))
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'albums' },
      (payload) => {
        setAlbums((prev) => prev.map(a => a.id === (payload.new as Album).id ? { ...a, ...(payload.new as Album) } : a))
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [])
```

This also means when one user rates tracks (updating `average_score`), the other user's homepage updates in real-time. And deleted albums disappear from the feed immediately.

**Requires:** `supabase` client imported into StashFeed — add `import { supabase } from '@/lib/supabase'`.

### 2.2 Optimistic Update Rollback

**Problem:** In `AlbumPageClient.tsx`, `rateTrack` updates local state immediately but doesn't revert if the DB write fails. The user sees a rating that never persisted.

**Fix:** Use a ref to capture previous state for rollback, keeping the `useCallback` dependency array lean (`[album.id]` only) to avoid unnecessary re-renders of `TrackRow` components:

```typescript
const tracksRef = useRef(tracks)
tracksRef.current = tracks
const averageRef = useRef(averageScore)
averageRef.current = averageScore

const rateTrack = useCallback(
  async (trackId: string, rating: number) => {
    // Capture previous state for rollback via refs
    const prevTracks = tracksRef.current
    const prevScore = averageRef.current

    // Optimistic update
    setTracks((prev) => {
      const next = prev.map((t) => (t.id === trackId ? { ...t, rating } : t))
      setAverageScore(computeAverage(next))
      return next
    })

    // Persist
    const { error } = await supabase.from('tracks').update({ rating }).eq('id', trackId)
    if (error) {
      // Rollback
      setTracks(prevTracks)
      setAverageScore(prevScore)
      // Toast notification (Wave 4) will surface this
      return
    }
    await supabase.rpc('recompute_album_average', { p_album_id: album.id })
  },
  [album.id]
)
```

Same pattern applies to `markInterlude`. This keeps `onRate`/`onInterlude` callback identity stable, avoiding re-renders of all TrackRow components on every rating change.

### 2.3 Color Extraction Fallback

**Problem:** `AlbumPageClient.tsx` line 51 catches color extraction errors silently. If it fails, the page stays on the default indigo but the user doesn't know why.

**Fix:** The silent catch is fine for UX — the user shouldn't see an error for a cosmetic feature. But ensure the fallback color is always applied. Change the default from the magic string `'#6366f1'` to a named constant (addressed in Wave 3). No behavioral change needed — current approach is correct.

### 2.4 Album Delete Navigation Safety

**Problem:** During album deletion, the user could tap "Back" and navigate away mid-operation, potentially seeing stale state.

**Fix:** Disable the back button while `deleting` is true:

```typescript
<button
  onClick={() => router.back()}
  disabled={deleting}
  className="... disabled:opacity-50 disabled:pointer-events-none"
>
```

---

## Wave 3: Performance Foundations

### 3.1 Pagination for Album Library

**Problem:** `app/page.tsx` loads ALL albums with no limit. At 200+ albums this means slow initial loads and unnecessary data transfer.

**Fix:** Implement cursor-based pagination:

**Server component (`app/page.tsx`):**
```typescript
const PAGE_SIZE = 30

export default async function HomePage() {
  const { data } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  return <StashFeed initialAlbums={(data as Album[]) ?? []} pageSize={PAGE_SIZE} />
}
```

**Client component (`StashFeed.tsx`):**
- Accept `pageSize` prop (no `totalCount` — use a `hasMore` boolean instead)
- Add a `loadMore` function that fetches the next page using `.range(offset, offset + pageSize - 1)`
- Determine `hasMore` by checking if the last fetch returned a full page (`fetchedCount === pageSize`)
- Show a "Load more" button at the bottom when `hasMore` is true
- The realtime subscription (Wave 2) handles new albums appearing at the top — `hasMore` is unaffected by realtime inserts since it's based on fetch results, not total count
- **Sort interaction with pagination:** When only a subset of albums is loaded, client-side "Top Rated" sort only sorts loaded albums — not the global top. This is acceptable UX at <200 albums where most will be loaded after a few "Load more" taps. At larger scale, sort should move to server-side queries (out of scope for now).

### 3.2 Extract Constants

**Problem:** Magic values scattered across components — default accent color `'#6366f1'`, debounce timing `350`, rating color thresholds.

**Fix:** Create `lib/constants.ts`:

```typescript
export const DEFAULT_ACCENT_COLOR = '#6366f1'
export const SEARCH_DEBOUNCE_MS = 350
export const ALBUMS_PAGE_SIZE = 30

export const RATING_THRESHOLDS = {
  GREAT: 8,   // emerald
  GOOD: 6,    // amber
  OKAY: 4,    // orange
  // below 4 = red
} as const
```

Update `TrackRow.tsx`, `AlbumPageClient.tsx`, and `SearchModal.tsx` to import from this file.

### 3.3 Stricter TypeScript in API Routes

**Problem:** `(body as Record<string, unknown>)` in `/api/import/route.ts` loses type safety.

**Fix:** Define a request body type and validate before casting:

```typescript
interface ImportBody {
  spotifyAlbumId: string
}

function isImportBody(body: unknown): body is ImportBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ImportBody).spotifyAlbumId === 'string'
  )
}
```

This replaces the existing manual validation with a type guard.

---

## Wave 4: UX Polish

### 4.1 Global Error Boundary

**Problem:** No custom error handling — crashes show the default Next.js error page.

**Fix:** Create `app/error.tsx`:

```typescript
'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-white">Something went wrong</p>
        <p className="mt-2 text-sm text-zinc-400">{error.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition-all hover:scale-105 active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

Also create `app/album/[id]/error.tsx` with similar styling but an option to go back to the library.

**Note:** `app/error.tsx` catches errors in page components but not in the root layout itself. For root layout crashes, `app/global-error.tsx` would be needed — but root layout crashes are extremely rare in this app. `app/error.tsx` covers the practical cases.

### 4.2 Skeleton Loading States

**Problem:** Pages show nothing or a blank screen while loading.

**Fix:** Create `app/loading.tsx` for the homepage:

- Render a mock header (same layout as StashFeed header but with no interactive elements)
- Show a grid of placeholder cards matching the default grid size
- Each card is a rounded rectangle with `animate-pulse` and `bg-zinc-800/50`

Create `app/album/[id]/loading.tsx` for the album detail page:

- Gradient background with a neutral gray
- Placeholder for cover art (rounded square, pulse animation)
- Placeholder lines for title/artist
- Placeholder track rows (8-10 rows with pulse bars)

These use Next.js App Router's built-in streaming — just exporting a `loading.tsx` component is enough.

### 4.3 Inline Error Recovery in SearchModal

**Problem:** Failed imports show `alert()` which is jarring and non-recoverable without closing/reopening.

**Fix:** Replace `alert()` calls with inline error state:

```typescript
const [importError, setImportError] = useState<string | null>(null)
```

- On import failure: `setImportError(data?.error ?? 'Failed to import album')`
- Render error as a dismissible banner at the top of the results list
- Clear error on next search or retry
- Add a "Retry" button next to the error message

### 4.4 Toast Notification System

**Problem:** No feedback mechanism for async operations (rating saved, delete complete, import failed).

**Fix:** Create a lightweight toast component at `components/Toast.tsx`:

- Uses React context (`ToastProvider`) wrapped around the app in `layout.tsx`
- `useToast()` hook returns `{ toast(message, type) }`
- Types: `success`, `error`, `info`
- Renders as a fixed bar at the bottom of the screen, above safe area
- Auto-dismisses after 3 seconds
- Stacks up to 3 toasts
- Matches the dark theme (zinc-800 bg, white text, colored left border)

Usage points:
- `AlbumPageClient`: rating save failure (rollback from Wave 2), delete success
- `SearchModal`: import failure (replaces alert alongside inline error)
- `StashFeed`: could show "New album added" when realtime fires

---

## Wave 5: Feature Additions

### 5.1 Sort Tracks by Rating

**Problem:** Track list is always in album order. No way to see highest-rated tracks at a glance.

**Fix:** Add a sort toggle to `AlbumPageClient.tsx`:

- Default: track order (current behavior)
- Toggle: sort by rating (highest first), unrated at bottom
- UI: small pill button below the average score, similar to the sort pills on the homepage
- State stored locally (not persisted — track order is the natural default)

Implementation:
```typescript
const [trackSort, setTrackSort] = useState<'default' | 'rating'>('default')

const displayTracks = useMemo(() => {
  if (trackSort === 'rating') {
    return [...tracks].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  }
  return tracks
}, [tracks, trackSort])
```

Render `displayTracks` instead of `tracks` in the track list.

### 5.2 Album Notes/Comments

**Problem:** No way to leave commentary or context on an album.

**Fix:** Add a `notes` text column to the `albums` table (nullable, text type).

UI in `AlbumPageClient.tsx`:
- Below the genre tags, above the track list
- Collapsed by default — shows a "Add a note..." button
- Expands to a textarea on tap
- Auto-saves on blur (debounced 500ms) via Supabase update
- Shows the note text when not editing, with a pencil icon to edit
- Max 500 characters with a character counter
- Realtime sync via the existing album channel (listen for UPDATE on albums table)
- **Concurrent editing:** Two users could edit notes simultaneously, with the last save winning. For a small friend group this is acceptable — the note is casual commentary, not critical data.

Update `lib/types.ts`:
```typescript
export interface Album {
  // ...existing fields
  notes: string | null
}
```

### 5.3 Bulk Rating

**Problem:** Rating 15+ tracks one by one is tedious for albums where most tracks are similar quality.

**Fix:** Add a "Rate all unrated" action to `AlbumPageClient.tsx`:

UI:
- Button appears below the average score when there are unrated non-interlude tracks
- Tapping opens a small inline control: a slider (1-10) + "Apply" button
- Applies the chosen rating to all currently unrated, non-interlude tracks
- Each track update goes through the same `rateTrack` function (optimistic + persist)
- After applying, the user can adjust individual tracks as needed

Implementation:
```typescript
const unratedCount = tracks.filter(t => t.rating === null && !t.is_interlude).length

async function bulkRate(rating: number) {
  const unrated = tracks.filter(t => t.rating === null && !t.is_interlude)

  // Optimistic update all at once
  setTracks((prev) => {
    const unratedIds = new Set(unrated.map(t => t.id))
    const next = prev.map(t => unratedIds.has(t.id) ? { ...t, rating } : t)
    setAverageScore(computeAverage(next))
    return next
  })

  // Batch DB update — single query instead of N sequential writes
  const { error } = await supabase
    .from('tracks')
    .update({ rating })
    .in('id', unrated.map(t => t.id))

  if (error) {
    // Rollback via ref
    setTracks(tracksRef.current)
    setAverageScore(averageRef.current)
    return
  }

  // Single RPC call to recompute average
  await supabase.rpc('recompute_album_average', { p_album_id: album.id })
}
```

### 5.4 Share/Export

**Problem:** No way to share album ratings with friends outside the app.

**Fix:** Add a "Share" button to the album detail header that copies a formatted text summary to clipboard:

```
🎵 Album Title — Artist
⭐ 7.4/10

1. Track One — 8
2. Track Two — 7
3. Track Three — 9
...

Rated on The Stash
```

Implementation:
- Button in the album detail header (share icon from lucide)
- Uses `navigator.clipboard.writeText()` with fallback
- Shows a toast ("Copied to clipboard!") on success
- No external service needed — just plain text

---

## Database Changes Summary

| Change | Table | Type |
|--------|-------|------|
| Add `notes` column | `albums` | `ALTER TABLE albums ADD COLUMN notes text` |

No other schema changes required. The favorites constraint issue (1.4) doesn't need schema changes since the current column-based approach is inherently single-valued per album.

**Configuration change:** Wave 2.1 requires Supabase Realtime to be enabled on the `albums` table (INSERT, UPDATE, DELETE events). Realtime is already enabled on `tracks` (used by `AlbumPageClient.tsx`), but the `albums` table subscription is new. Enable via Supabase Dashboard > Database > Replication, or via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE albums;`

---

## Testing Strategy

Each wave should be verified before moving to the next:

- **Wave 1:** Test manual import with malformed URLs, HTML in text fields, empty tracks. Verify shared import helper works for both Spotify and manual flows.
- **Wave 2:** Import an album, navigate back, verify it appears. Rate a track with network devtools throttled to offline, verify rollback. Delete an album and verify back button is disabled during operation.
- **Wave 3:** Add 30+ albums, verify pagination loads correctly. Verify constants are used everywhere (grep for old magic values).
- **Wave 4:** Trigger an error (e.g., invalid album ID in URL), verify error boundary. Navigate to pages and verify skeleton states appear. Fail an import and verify inline error + toast.
- **Wave 5:** Test track sort toggle. Add/edit/clear notes. Bulk rate unrated tracks. Copy share text and verify format.

---

## Implementation Order

Waves must be implemented in order (1 through 5). Within each wave, items can be done in any order. Each wave should be committed as a logical unit.

## Out of Scope

- User accounts (deprioritized per user request)
- Virtual scrolling (unnecessary until 500+ albums)
- Offline-first capabilities beyond current service worker
- Push notifications
