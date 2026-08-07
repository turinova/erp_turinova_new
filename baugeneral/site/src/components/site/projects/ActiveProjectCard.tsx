"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef } from "react"
import gsap from "gsap"
import { ProjectCategoryChip } from "@/components/site/projects/ProjectCategoryChip"
import { ProjectOwnershipChip } from "@/components/site/projects/ProjectOwnershipChip"
import { ProjectPhaseBar } from "@/components/site/projects/ProjectPhaseBar"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { formatTimelineDate, getProjectTimelineState } from "@/lib/project-timeline"
import type { ActiveProject } from "@/lib/projects"
import { activeProjectDetailPath } from "@/lib/projects"

type ActiveProjectCardProps = {
  project: ActiveProject
  entranceIndex?: number
}

export function ActiveProjectCard({
  project,
  entranceIndex = 0,
}: ActiveProjectCardProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const timeline = useMemo(() => getProjectTimelineState(project), [project])

  useEffect(() => {
    const link = linkRef.current
    if (reduced || !link) return

    gsap.fromTo(
      link,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        delay: entranceIndex * 0.07,
        ease: "power3.out",
      },
    )
  }, [entranceIndex, reduced])

  const handleEnter = () => {
    if (reduced || !imageRef.current) return
    gsap.to(imageRef.current, { scale: 1.03, duration: 0.35, ease: "power2.out" })
  }

  const handleLeave = () => {
    if (reduced || !imageRef.current) return
    gsap.to(imageRef.current, { scale: 1, duration: 0.35, ease: "power2.out" })
  }

  return (
    <Link
      ref={linkRef}
      href={activeProjectDetailPath(project.slug)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="group grid overflow-hidden rounded-[var(--radius-md)] border border-black/8 bg-white shadow-[var(--shadow-soft)] transition hover:border-black/12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <div className="relative h-[200px] overflow-hidden bg-stone-300 md:h-full md:min-h-[220px]">
        <div ref={imageRef} className="absolute inset-0 origin-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.cardImage.src}
            alt={project.cardImage.alt}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/5" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-white backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-live)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-live)]" />
          </span>
          {timeline.progressPercent}%
        </span>
      </div>

      <div className="flex flex-col justify-center gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectOwnershipChip ownership={project.ownership} />
          <ProjectCategoryChip category={project.category} />
        </div>
        <h2 className="text-base font-semibold leading-snug text-black/90 md:text-lg">
          {project.title}
        </h2>
        <p className="line-clamp-2 text-sm leading-relaxed text-black/55">{project.tldr}</p>
        <ProjectPhaseBar phase={timeline.phase} compact />
        <p className="text-xs text-black/45 md:text-sm">
          {formatTimelineDate(timeline.today)} · {project.city}
        </p>
      </div>
    </Link>
  )
}
