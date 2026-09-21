'use client'

import { Check, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  ACCENT_STYLES,
  HOW_IT_WORKS_STEPS,
  PACKAGE_LABEL,
  type HowItWorksStep
} from '@/lib/marketing/how-it-works'
import { cn } from '@/lib/utils'

export function HowItWorksJumpNav() {
  const [activeId, setActiveId] = useState(HOW_IT_WORKS_STEPS[0]?.id ?? '')

  useEffect(() => {
    const nodes = HOW_IT_WORKS_STEPS.map((s) =>
      document.getElementById(s.id)
    ).filter((el): el is HTMLElement => Boolean(el))

    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
          )
        const top = visible[0]
        if (top?.target?.id) setActiveId(top.target.id)
      },
      {
        rootMargin: '-30% 0px -55% 0px',
        threshold: [0, 0.25, 0.5]
      }
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      className="sticky top-[52px] z-30 border-b border-border bg-white/90 backdrop-blur-md"
      aria-label="Modulok"
    >
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HOW_IT_WORKS_STEPS.map((step) => {
          const styles = ACCENT_STYLES[step.accent]
          const active = activeId === step.id
          const Icon = step.Icon
          return (
            <a
              key={step.id}
              href={`#${step.id}`}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium no-underline transition-colors',
                active ? styles.chipActive : styles.chip
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {step.navLabel}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export function HowItWorksSections() {
  return (
    <div>
      {HOW_IT_WORKS_STEPS.map((step, index) => (
        <HowItWorksSection
          key={step.id}
          step={step}
          reverse={index % 2 === 1}
          index={index}
        />
      ))}
    </div>
  )
}

function HowItWorksSection({
  step,
  reverse,
  index
}: {
  step: HowItWorksStep
  reverse: boolean
  index: number
}) {
  const styles = ACCENT_STYLES[step.accent]
  const Icon = step.Icon
  const tinted = index % 2 === 1

  return (
    <section
      id={step.id}
      className={cn(
        'scroll-mt-[7.5rem] border-b border-border/60',
        tinted ? styles.section : 'bg-white'
      )}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className={cn(reverse && 'lg:order-2')}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex size-9 items-center justify-center rounded-xl',
                styles.iconWrap
              )}
            >
              <Icon className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <span
              className={cn(
                'inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium',
                styles.badge
              )}
            >
              {PACKAGE_LABEL[step.package]}
            </span>
            <span className="text-[12px] font-medium text-ink-muted">
              {index + 1} / {HOW_IT_WORKS_STEPS.length}
            </span>
          </div>
          <h2 className="mt-4 text-[1.75rem] font-semibold tracking-tight text-ink md:text-[2rem]">
            {step.title}
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-secondary">
            {step.body}
          </p>
          <ul className="mt-6 space-y-2.5">
            {step.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 text-[14px] leading-snug text-ink"
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white',
                    styles.play
                  )}
                >
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className={cn(reverse && 'lg:order-1')}>
          <VideoPlaceholder step={step} />
        </div>
      </div>
    </section>
  )
}

function VideoPlaceholder({ step }: { step: HowItWorksStep }) {
  const styles = ACCENT_STYLES[step.accent]

  if (step.youtubeId) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-subtle shadow-sm">
        <div className="aspect-video">
          <iframe
            title={`${step.title} — demóvideó`}
            src={`https://www.youtube-nocookie.com/embed/${step.youtubeId}`}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border shadow-sm',
        styles.frame
      )}
      role="img"
      aria-label={`${step.title} — videó hamarosan`}
    >
      {/* Fake product chrome — craft, ne dashed üresség */}
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-white/50 px-3 py-2">
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="size-2 rounded-full bg-black/15" />
        <span className="ml-2 h-2 w-24 rounded-full bg-black/10" />
      </div>
      <div className="relative flex aspect-[16/9] flex-col items-center justify-center gap-4 px-6">
        <div className="absolute inset-6 rounded-lg border border-dashed border-black/10 bg-white/40" />
        <button
          type="button"
          tabIndex={-1}
          className={cn(
            'relative z-[1] flex size-16 items-center justify-center rounded-full shadow-md',
            styles.play
          )}
          aria-hidden
        >
          <Play className="size-7 fill-current" />
        </button>
        <div className="relative z-[1] text-center">
          <p className="text-[15px] font-semibold text-ink">{step.title}</p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Demóvideó hamarosan
          </p>
        </div>
      </div>
    </div>
  )
}
