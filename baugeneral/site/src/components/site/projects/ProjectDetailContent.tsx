import type { ActiveProject } from "@/lib/projects"

export function ProjectDetailContent({ project }: { project: ActiveProject }) {
  return (
    <section
      aria-labelledby="project-summary-heading"
      className="rounded-[var(--radius-md)] border border-black/8 bg-white px-5 py-5 md:px-6 md:py-6"
    >
      <h2
        id="project-summary-heading"
        className="text-sm font-semibold uppercase tracking-wide text-black/45"
      >
        Összefoglaló
      </h2>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-black/85 md:text-lg md:leading-8">
        {project.tldr}
      </p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-black/45">
        Aktuális állapot
      </h2>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-black/85 md:text-lg md:leading-8">
        {project.currentStatus}
      </p>
    </section>
  )
}
