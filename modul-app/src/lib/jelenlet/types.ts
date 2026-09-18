export const JELENLET_ADDON_KEY = 'jelenlet' as const
export const JELENLET_FEATURE = 'jelenlet' as const

export const JELENLET_PAGE_KEYS = [
  '/jelenlet',
  '/jelenlet/naptar',
  '/dolgozok',
  '/dolgozok/tipusok'
] as const

export const ABSENCE_TYPES = [
  'vacation',
  'sick',
  'unpaid',
  'other'
] as const

export type AbsenceType = (typeof ABSENCE_TYPES)[number]

export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  vacation: 'Szabadság',
  sick: 'Betegszabadság',
  unpaid: 'Fizetés nélküli',
  other: 'Egyéb'
}

export const WORK_CALENDAR_DAY_TYPES = [
  'national',
  'company',
  'relocated_work',
  'relocated_rest'
] as const

export type WorkCalendarDayType = (typeof WORK_CALENDAR_DAY_TYPES)[number]

export const WORK_CALENDAR_DAY_TYPE_LABEL: Record<WorkCalendarDayType, string> =
  {
    national: 'Nemzeti ünnep',
    company: 'Céges munkaszünet',
    relocated_work: 'Áthelyezett munkanap',
    relocated_rest: 'Áthelyezett pihenőnap'
  }

export type HrEmployeeTypeRow = {
  id: string
  name: string
  code: string
  sortOrder: number
  active: boolean
  isDefault: boolean
}

export type HrWorkCalendarRow = {
  id: string
  workDate: string
  dayType: WorkCalendarDayType
  name: string
}
