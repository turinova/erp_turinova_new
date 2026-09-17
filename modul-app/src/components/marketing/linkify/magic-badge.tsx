export function MagicBadge({ title }: { title: string }) {
  return (
    <div className="relative inline-flex h-8 select-none overflow-hidden rounded-full p-[1.5px] focus:outline-none">
      <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#b91c1c_0%,#fca5a5_50%,#b91c1c_100%)]" />
      <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-white px-4 py-1 text-sm font-medium text-zinc-900 backdrop-blur-3xl">
        {title}
      </span>
    </div>
  )
}
