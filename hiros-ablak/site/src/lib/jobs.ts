/**
 * Nyitott állások — Karrier oldal.
 * Fizetés nem jelenik meg a UI-n (üzleti döntés).
 * Szövegezés: hétköznapi magyar, Meta-biztos (munkáról, nem védett tulajdonságokról).
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
  perks: readonly string[]
  requirements: readonly string[]
  datePosted: string
  active: boolean
}

export const JOBS: readonly Job[] = [
  {
    slug: "bolti-elado",
    title: "Bolti eladó",
    short:
      "Kecskeméti barkácsáruházunkba keresünk bolti eladó munkatársat. Hétfő–péntek 7:30-tól 17:00-ig, egy műszak. Időnként szombat 8:00-tól 12:00-ig. Mindszenti krt. 10.",
    location: "Kecskemét, Mindszenti krt. 10.",
    employmentType: "FULL_TIME",
    employmentLabel: "Teljes munkaidő, egy műszak",
    area: "aruhaz",
    experience: "betanitott",
    workStyle: "emberi",
    tasks: [
      "Vásárlók fogadása és kiszolgálása",
      "Áru és polcok rendben tartása",
      "Pénztár és egyszerű adminisztráció",
    ],
    perks: [
      "Egy műszak, nincs éjszakázás",
      "Betanítás, stabil munka",
      "Kecskeméten, helyben",
    ],
    requirements: [
      "Pontos érkezés reggel 7:30-ra",
      "Munkaidő: hétfő–péntek 7:30-tól 17:00-ig",
      "Időnként szombat délelőtt (8:00-tól 12:00-ig)",
      "Bolti tapasztalat előny, nem kötelező",
    ],
    datePosted: "2026-11-12",
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
      "Feladatok:",
      ...job.tasks.map((t) => `• ${t}`),
      "",
      "Amit kínálunk:",
      ...job.perks.map((p) => `• ${p}`),
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
