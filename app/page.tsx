import { ALBUMS_PAGE_SIZE } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import StashFeed from '@/components/StashFeed'
import type { Album } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { data } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, ALBUMS_PAGE_SIZE - 1)

  return <StashFeed initialAlbums={(data as Album[]) ?? []} pageSize={ALBUMS_PAGE_SIZE} />
}
