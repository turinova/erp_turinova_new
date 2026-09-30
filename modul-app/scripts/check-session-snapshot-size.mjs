/**
 * Smoke: full-access session snapshot wire v2 stays under Safari cookie max.
 * Run: node --env-file=.env.local --import tsx scripts/check-session-snapshot-size.mjs
 * or:  npx tsx --env-file=.env.local scripts/check-session-snapshot-size.mjs
 */
import {
  assertSnapshotTokenSize,
  buildSessionSnapshot,
  decodePageBitset,
  encodePageBitset,
  signSessionSnapshot,
  verifySessionSnapshotToken
} from '../src/lib/auth/session-snapshot.ts'
import { ALL_PAGE_KEYS } from '../src/lib/permissions/pages.ts'

if (!process.env.SESSION_SNAPSHOT_SECRET) {
  process.env.SESSION_SNAPSHOT_SECRET = 'local-check-secret-16+'
}

const pages = [...ALL_PAGE_KEYS]
const snap = buildSessionSnapshot({
  userId: '00000000-0000-0000-0000-000000000000',
  email: 'admin@hirosablak.hu',
  displayName: 'Mező Dávid Platform Admin Hosszú',
  tenantId: '45dd7c02-28e9-4f4a-b74c-704f63437927',
  tenantSlug: 'hiros-ablak',
  tenantName: 'Hírös Ablak Kft. Kecskemét',
  membershipId: '11111111-1111-1111-1111-111111111111',
  role: 'owner',
  allowedPages: pages,
  entitledPages: pages,
  canManageUsers: true,
  isPlatformAdmin: true,
  hasMembership: true,
  nonce: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
})

const token = await signSessionSnapshot(snap)
const size = assertSnapshotTokenSize(token)
const round = await verifySessionSnapshotToken(token)
const bits = encodePageBitset(pages)
const partial = encodePageBitset(['/home', '/pos'])
const partialDecoded = decodePageBitset(partial)

const ok =
  size.ok &&
  bits === '*' &&
  round?.allowedPages.length === pages.length &&
  round?.entitledPages.length === pages.length &&
  partialDecoded.includes('/home') &&
  partialDecoded.includes('/pos') &&
  size.bytes < 2500

console.log(
  JSON.stringify(
    {
      pageCount: pages.length,
      bitset: bits,
      partial,
      tokenBytes: size.bytes,
      sizeOk: size.ok,
      verifyOk: Boolean(round),
      ok
    },
    null,
    2
  )
)

if (!ok) process.exit(1)
