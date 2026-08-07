import type { ServiceBuildingType, ServiceSectionHeadings } from "@/lib/services"

type ServiceBuildingTypesProps = {
  items: readonly ServiceBuildingType[]
  headings: Pick<ServiceSectionHeadings, "buildingTypes">
}

export function ServiceBuildingTypes({ items, headings }: ServiceBuildingTypesProps) {
  const count = items.length
  const isTwoByTwo = count === 4
  const isDense = count >= 8

  let gridClass = "sm:grid-cols-2 lg:grid-cols-3"
  if (isTwoByTwo) gridClass = "sm:grid-cols-2 lg:grid-cols-2"
  if (isDense) gridClass = "sm:grid-cols-2 lg:grid-cols-5"

  return (
    <section
      id="service-types"
      aria-labelledby="service-building-types-heading"
      className="mx-auto max-w-6xl px-4 scroll-mt-24"
    >
      <h2 id="service-building-types-heading" className="service-h2">
        {headings.buildingTypes}
      </h2>

      <ul className={["mt-6 grid gap-4", gridClass].join(" ")}>
        {items.map((item) => (
          <li key={item.title}>
            <BuildingCard item={item} large={!isTwoByTwo && !isDense} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BuildingCard({
  item,
  large = false,
}: {
  item: ServiceBuildingType
  large?: boolean
}) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-lg)] border border-black/10 bg-white shadow-[var(--shadow-soft)]">
      <div className={large ? "aspect-[5/3] overflow-hidden" : "aspect-[16/10] overflow-hidden"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.imageAlt}
          className="h-full w-full object-cover object-center"
          loading="lazy"
        />
      </div>
      <div className="px-4 py-4 md:px-5 md:py-5">
        <h3 className="text-lg font-semibold leading-snug text-[var(--foreground)]">
          {item.title}
        </h3>
        <p className="service-body mt-2">{item.description}</p>
      </div>
    </article>
  )
}
