import { z } from 'zod'

/** Jelenléti ív szabálykészlet — kliens + szerver közös (nincs server import). */

export const SHEET_BASES = ['official', 'internal'] as const
export type SheetBase = (typeof SHEET_BASES)[number]

export const sheetRulesSchema = z.object({
  base: z.enum(SHEET_BASES),
  /** real = rögzített idők; generated = 8 órás sablon idő (nyitó/záró rotáció) */
  times: z.enum(['real', 'generated']),
  /** Érkezés/távozás műszakhoz igazítása ± perc (csak real) */
  graceMinutes: z.coerce.number().int().min(0).max(30),
  /** Napi normál keret: 8 óra felett „+” rész (csak real) */
  capDailyAt8: z.boolean(),
  /** Dolgozói túlóra szabály (műszak utáni + korai) a „+” részbe (csak real) */
  includePolicyOvertime: z.boolean(),
  /** Generált kezdések: nyitó, záró (a többiek napváltósan) */
  generatedStartOpen: z.string().regex(/^\d{2}:\d{2}$/),
  generatedStartClose: z.string().regex(/^\d{2}:\d{2}$/),
  /** Nyitó/záró rotáció dolgozó típusai (hr_employee_types.id) */
  rotationTypeIds: z.array(z.string().uuid()).max(50),
  saturday: z.enum(['hidden', 'show_excluded', 'shift_next_workday']),
  saturdayMaxMinutes: z.coerce.number().int().min(0).max(480),
  leavePlusWork: z.enum(['leave', 'work']),
  holidayPlusWork: z.enum(['holiday', 'work']),
  incomplete: z.enum(['blank', 'label']),
  showEmployeeSignature: z.boolean()
})

export type SheetRules = z.infer<typeof sheetRulesSchema>

export const OFFICIAL_SHEET_RULES: SheetRules = {
  base: 'official',
  times: 'generated',
  graceMinutes: 0,
  capDailyAt8: true,
  includePolicyOvertime: false,
  generatedStartOpen: '08:00',
  generatedStartClose: '08:30',
  rotationTypeIds: [],
  saturday: 'shift_next_workday',
  saturdayMaxMinutes: 240,
  leavePlusWork: 'leave',
  holidayPlusWork: 'holiday',
  incomplete: 'blank',
  showEmployeeSignature: true
}

export const INTERNAL_SHEET_RULES: SheetRules = {
  base: 'internal',
  times: 'real',
  graceMinutes: 10,
  capDailyAt8: true,
  includePolicyOvertime: true,
  generatedStartOpen: '08:00',
  generatedStartClose: '08:30',
  rotationTypeIds: [],
  saturday: 'show_excluded',
  saturdayMaxMinutes: 480,
  leavePlusWork: 'leave',
  holidayPlusWork: 'holiday',
  incomplete: 'label',
  showEmployeeSignature: false
}

export const BUILTIN_PRESETS = [
  {
    id: 'builtin:official',
    name: 'Hivatalos',
    rules: OFFICIAL_SHEET_RULES
  },
  {
    id: 'builtin:internal',
    name: 'Belső (papír)',
    rules: INTERNAL_SHEET_RULES
  }
] as const

export type SheetPresetOption = {
  id: string
  name: string
  rules: SheetRules
  builtin: boolean
}

export function builtinPresetOptions(): SheetPresetOption[] {
  return BUILTIN_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    rules: { ...p.rules, rotationTypeIds: [...p.rules.rotationTypeIds] },
    builtin: true
  }))
}

/** Mentett JSON → érvényes szabály; hiányzó kulcs = az alap sablon értéke. */
export function normalizeSheetRules(raw: unknown): SheetRules {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const base = obj.base === 'official' ? OFFICIAL_SHEET_RULES : INTERNAL_SHEET_RULES
  const merged = { ...base, ...obj }
  const parsed = sheetRulesSchema.safeParse(merged)
  return parsed.success ? parsed.data : { ...base }
}

function minutesLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} óra`
  return `${(min / 60).toFixed(1).replace('.', ',')} óra`
}

/** Rövid, emberi nyelvű összefoglaló a varázsló 2. lépéséhez. */
export function describeSheetRules(r: SheetRules): string[] {
  const out: string[] = []
  if (r.times === 'generated') {
    out.push(
      `Generált idők: ${r.generatedStartOpen} / ${r.generatedStartClose} kezdés, napi 8 óra`
    )
  } else {
    out.push(
      r.graceMinutes > 0
        ? `Rögzített idők, ±${r.graceMinutes} perc a műszakhoz igazítva`
        : 'Rögzített idők, igazítás nélkül'
    )
    if (r.capDailyAt8) {
      out.push(
        r.includePolicyOvertime
          ? 'Napi max. 8 óra normál, felette + túlóra (dolgozói szabály is)'
          : 'Napi max. 8 óra normál, felette + rész'
      )
    }
  }
  if (r.saturday === 'hidden') out.push('Szombat nem jelenik meg')
  if (r.saturday === 'show_excluded') out.push('Szombat látszik, az összesbe nem számít')
  if (r.saturday === 'shift_next_workday') {
    out.push(
      `Szombat (max. ${minutesLabel(r.saturdayMaxMinutes)}) a következő munkanapból levonva`
    )
  }
  out.push(
    r.leavePlusWork === 'leave'
      ? 'Szabadság + munka = szabadság (0 óra)'
      : 'Szabadság + munka = munka'
  )
  out.push(
    r.holidayPlusWork === 'holiday'
      ? 'Munkaszüneti nap + munka = munkaszünet'
      : 'Munkaszüneti nap + munka = munka'
  )
  out.push(r.incomplete === 'label' ? 'Hiányos nap: HIÁNYOS felirat' : 'Hiányos nap: üres sor')
  return out
}
