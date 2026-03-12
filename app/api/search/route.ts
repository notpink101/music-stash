import { NextRequest, NextResponse } from 'next/server'
import { searchAlbums } from '@/lib/spotify'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()

  if (!q) {
    return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 })
  }

  try {
    const results = await searchAlbums(q)
    return NextResponse.json(results)
  } catch (err) {
    console.error('[/api/search]', err)
    return NextResponse.json({ error: 'Spotify search failed' }, { status: 502 })
  }
}
