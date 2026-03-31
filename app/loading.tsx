export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* Header skeleton */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md pt-safe">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <div className="flex items-center gap-2.5">
            {/* Icon placeholder */}
            <div className="h-4.5 w-4.5 animate-pulse rounded-full bg-zinc-800/50" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-zinc-800/50" />
            </div>
          </div>
          {/* Plus button placeholder */}
          <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-800/50" />
        </div>
        {/* Search bar placeholder */}
        <div className="mx-4 mb-3 h-10 animate-pulse rounded-full bg-zinc-800/50" />
      </header>

      {/* Controls row skeleton */}
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="flex gap-1.5">
          <div className="h-7 w-16 animate-pulse rounded-full bg-zinc-800/50" />
          <div className="h-7 w-20 animate-pulse rounded-full bg-zinc-800/50" />
          <div className="h-7 w-10 animate-pulse rounded-full bg-zinc-800/50" />
          <div className="h-7 w-14 animate-pulse rounded-full bg-zinc-800/50" />
        </div>
        <div className="h-7 w-24 animate-pulse rounded-full bg-zinc-800/50" />
      </div>

      {/* Album grid skeleton — 12 cards, small grid (6 cols) */}
      <div className="grid grid-cols-6 gap-1 px-2 pt-1 sm:grid-cols-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            {/* Square album art placeholder */}
            <div className="aspect-square w-full animate-pulse rounded-xl bg-zinc-800/50" />
            {/* Title bar */}
            <div
              className="h-2 animate-pulse rounded bg-zinc-800/50"
              style={{ width: `${55 + (i % 4) * 10}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
