import type { HomeSolution } from './solutions-data'
import { STAGE_SURFACE } from './solutions-data'
import SolutionMock from './SolutionMock'

type Props = {
  solution: HomeSolution
  reverse?: boolean
}

export default function SolutionSection({ solution, reverse = false }: Props) {
  const surface = STAGE_SURFACE[solution.stage]

  return (
    <section id={solution.id} className={`scroll-mt-20 py-16 sm:py-24 ${surface.band}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className={reverse ? 'lg:order-2' : undefined}>
            <div className={`mb-5 h-1.5 w-14 rounded-full ${surface.bar}`} />
            <h2 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-bold tracking-tight text-slate-900 leading-snug">
              {solution.label}
            </h2>
          </div>

          <div className={`relative ${reverse ? 'lg:order-1' : ''}`}>
            <div
              aria-hidden
              className={`pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${surface.wash}`}
            />
            <div
              className={`relative rounded-xl overflow-hidden border ${surface.border} shadow-[0_22px_50px_-18px_rgba(15,23,42,0.4)] bg-white`}
            >
              <SolutionMock kind={solution.mock} compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
