import { supabase } from '@/lib/supabase'
import StashFeed from '@/components/StashFeed'
import type { Album } from '@/lib/types'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

export default async function HomePage() {
  const { data } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  return <StashFeed initialAlbums={(data as Album[]) ?? []} pageSize={PAGE_SIZE} />
}
