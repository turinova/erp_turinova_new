import { cn } from '@/lib/utils'

export function MaxWidthWrapper({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'mx-auto h-full w-full max-w-full px-4 md:max-w-screen-xl md:px-12 lg:px-20',
        className
      )}
    >
      {children}
    </section>
  )
}
