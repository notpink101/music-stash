'use client'

import { useRouter } from 'next/navigation'

export default function AlbumError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()

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
        <button
          onClick={() => router.push('/')}
          className="mt-3 rounded-full border border-zinc-700 px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
        >
          Back to library
        </button>
      </div>
    </div>
  )
}
