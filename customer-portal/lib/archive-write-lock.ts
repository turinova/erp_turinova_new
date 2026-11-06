import { NextResponse } from 'next/server'

import {
  getMigrationNotice,
  MIGRATION_DEADLINE_ISO,
  NEW_SYSTEM_LABEL,
  NEW_SYSTEM_URL
} from '@/lib/migration-notice'

/**
 * After MIGRATION_DEADLINE_ISO the legacy portal is archive-only:
 * login + browse OK; create/save/submit/delete blocked.
 */
export const ARCHIVE_WRITE_LOCKED_MESSAGE =
  `Az archívumban már nem lehet új megrendelést menteni vagy beküldeni. Új rendelés: ${NEW_SYSTEM_LABEL} (${NEW_SYSTEM_URL}).`

export function isArchiveWriteLocked(now: Date = new Date()): boolean {
  return getMigrationNotice(now).phase === 'after'
}

export function archiveWriteLockedResponse() {
  return NextResponse.json(
    {
      error: ARCHIVE_WRITE_LOCKED_MESSAGE,
      code: 'ARCHIVE_WRITE_LOCKED',
      deadline: MIGRATION_DEADLINE_ISO,
      newSystemUrl: NEW_SYSTEM_URL
    },
    { status: 403 }
  )
}
