export default function Loading() {
  // Varying widths for track title bars to look natural
  const trackWidths = [72, 55, 80, 63, 88, 50, 76, 60, 84, 68]

  return (
    <div className="min-h-screen bg-zinc-900">

      {/* Header: back button + delete icon */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 pt-safe">
        <div className="mt-2 flex items-center gap-1 rounded-xl px-2.5 py-2">
          <div className="h-5 w-5 animate-pulse rounded bg-zinc-800/50" />
          <div className="h-4 w-8 animate-pulse rounded bg-zinc-800/50" />
        </div>
        <div className="mt-2 h-8 w-8 animate-pulse rounded-xl bg-zinc-800/50" />
      </div>

      <div className="px-4 pb-32">
        {/* Cover art placeholder */}
        <div className="flex justify-center pb-5">
          <div className="h-52 w-52 animate-pulse rounded-2xl bg-zinc-800/50 sm:h-64 sm:w-64" />
        </div>

        {/* Meta placeholders */}
        <div className="flex flex-col items-center gap-2">
          {/* Album title */}
          <div className="h-7 w-48 animate-pulse rounded-lg bg-zinc-800/50" />
          {/* Artist */}
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/50" />
          {/* Year */}
          <div className="h-3.5 w-12 animate-pulse rounded bg-zinc-800/50" />

          {/* Genre pills */}
          <div className="mt-1 flex gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800/50" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-800/50" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-zinc-800/50" />
          </div>

          {/* Score placeholder */}
          <div className="mt-5 h-14 w-24 animate-pulse rounded-xl bg-zinc-800/50" />
        </div>

        {/* Track list placeholder */}
        <div className="mt-8 rounded-2xl bg-black/30 px-4 backdrop-blur-sm">
          {trackWidths.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-white/5 py-3.5 last:border-none"
            >
              {/* Track number */}
              <div className="h-3.5 w-4 shrink-0 animate-pulse rounded bg-zinc-800/50" />
              {/* Track title */}
              <div
                className="h-4 animate-pulse rounded bg-zinc-800/50"
                style={{ width: `${w}%` }}
              />
              {/* Rating bar (right side) */}
              <div className="ml-auto h-4 w-16 shrink-0 animate-pulse rounded-full bg-zinc-800/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
