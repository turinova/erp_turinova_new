import { HOME_SOLUTIONS } from './solutions-data'
import SolutionSection from './SolutionSection'

export default function SolutionsStack() {
  return (
    <div>
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Termékeink</h2>
        </div>
      </div>

      {HOME_SOLUTIONS.map((solution, i) => (
        <SolutionSection key={solution.id} solution={solution} reverse={i % 2 === 1} />
      ))}
    </div>
  )
}
