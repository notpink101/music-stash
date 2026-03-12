import { supabase } from '@/lib/supabase'
import StashFeed from '@/components/StashFeed'
import type { Album } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { data } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false })

  return <StashFeed initialAlbums={(data as Album[]) ?? []} />
}
