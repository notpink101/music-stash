import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AlbumPageClient from './AlbumPageClient'
import type { Album, Track } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AlbumPage({ params }: Props) {
  const { id } = await params

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .single()

  if (!album) notFound()

  const { data: tracks } = await supabase
    .from('tracks')
    .select('*')
    .eq('album_id', id)
    .order('track_number', { ascending: true })

  return (
    <AlbumPageClient
      album={album as Album}
      initialTracks={(tracks as Track[]) ?? []}
    />
  )
}
