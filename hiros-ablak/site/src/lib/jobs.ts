/**
 * Nyitott állások — Karrier oldal.
 * Fizetés nem jelenik meg a UI-n (üzleti döntés).
 * Szövegezés igazítva a Facebook / nyomtatott hirdetéshez.
 */

import { COMPANY } from "@/lib/company"
import { absoluteUrl } from "@/lib/seo"

export type Job = {
  slug: string
  title: string
  short: string
  location: string
  employmentType: "FULL_TIME" | "PART_TIME"
  employmentLabel: string
  area: "uzem" | "aruhaz" | "iroda"
  experience: "betanitott" | "tapasztalt"
  workStyle: "gepes" | "emberi" | "vegyes"
  tasks: readonly string[]
  requirements: readonly string[]
  datePosted: string
  active: boolean
}

export const JOBS: readonly Job[] = [
  {
    slug: "elzarogep-kezelo",
    title: "Élzárógép-kezelő",
    short:
      "Kecskeméti gyártóüzemünkbe keresünk élzárógép-kezelő munkatársat teljes munkaidőbe. H–P, 1 műszak.",
    location: "Kecskemét",
    employmentType: "FULL_TIME",
    employmentLabel: "Teljes munkaidő · H–P, 1 műszak",
    area: "uzem",
    experience: "tapasztalt",
    workStyle: "gepes",
    tasks: [
      "Stabil, hosszú távú munka",
      "Segítőkész, összetartó csapat",
      "Modern géppark, családias légkör",
    ],
    requirements: [
      "Faipari tapasztalat vagy termelőgép-kezelés",
      "Precíz, rendezett munkavégzés",
      "Hétfőtől péntekig, 1 műszakos beosztás",
    ],
    datePosted: "2026-07-27",
    active: true,
  },
] as const

export function getActiveJobs(): Job[] {
  return JOBS.filter((j) => j.active)
}

export function getJobBySlug(slug: string): Job | undefined {
  return JOBS.find((j) => j.slug === slug && j.active)
}

/** Egyszerű „illik hozzám?” ajánló — szabályalapú, nem LLM. */
export function recommendJobs(answers: {
  area: Job["area"] | "mindegy"
  workStyle: Job["workStyle"] | "mindegy"
  experience: Job["experience"] | "mindegy"
}): Job[] {
  const active = getActiveJobs()
  const scored = active.map((job) => {
    let score = 0
    if (answers.area === "mindegy" || answers.area === job.area) score += 2
    if (answers.workStyle === "mindegy" || answers.workStyle === job.workStyle)
      score += 2
    if (
      answers.experience === "mindegy" ||
      answers.experience === job.experience
    )
      score += 2
    return { job, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.filter((s) => s.score > 0).map((s) => s.job)
}

export function buildJobPostingJsonLd(job: Job) {
  const url = absoluteUrl(`/karrier#${job.slug}`)
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [
      job.short,
      "",
      "Amit kínálunk:",
      ...job.tasks.map((t) => `• ${t}`),
      "",
      "Elvárások:",
      ...job.requirements.map((r) => `• ${r}`),
    ].join("\n"),
    datePosted: job.datePosted,
    employmentType: job.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: COMPANY.shortName,
      sameAs: COMPANY.website,
      logo: `${COMPANY.website}/img/hiros_logo.png`,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: COMPANY.address.street,
        addressLocality: COMPANY.address.city,
        postalCode: COMPANY.address.postalCode,
        addressCountry: COMPANY.address.countryCode,
      },
    },
    url,
    directApply: true,
  }
}
