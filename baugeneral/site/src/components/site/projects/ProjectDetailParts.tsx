import Link from "next/link"
import type { ActiveProject } from "@/lib/projects"
import { activeProjectDetailPath } from "@/lib/projects"

export function ProjectThumbCard({ project }: { project: ActiveProject }) {
  return (
    <Link
      href={activeProjectDetailPath(project.slug)}
      className="group block overflow-hidden rounded-[var(--radius-sm)] border border-black/8 bg-white"
    >
      <div className="relative h-[72px] overflow-hidden bg-stone-300 md:h-[84px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.cardImage.src}
          alt={project.cardImage.alt}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <p className="line-clamp-2 px-2 py-2 text-[0.6875rem] font-medium leading-snug text-black/75">
        {project.title}
      </p>
    </Link>
  )
}
