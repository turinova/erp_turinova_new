import Link from 'next/link'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import {
  ARCHIVE_LABEL,
  ARCHIVE_URL,
  MIGRATION_DEADLINE_LABEL,
  MIGRATION_DEADLINE_SHORT,
  MIGRATION_SWITCH_LABEL,
  NEW_SYSTEM_LABEL,
  NEW_SYSTEM_URL,
  SUPPORT_PHONE_LABEL,
  SUPPORT_PHONE_TEL,
  migrationCountdownLabel,
  type MigrationNotice
} from '@/lib/migration-notice'

const filledLinkSx = {
  '& a:not(.MuiButton-root)': { color: 'inherit', fontWeight: 700, textDecoration: 'underline' }
} as const

const whiteChipSx = {
  bgcolor: 'common.white',
  color: 'error.main',
  fontWeight: 700
} as const

function CountdownChip({ notice, onFilled }: { notice: MigrationNotice; onFilled: boolean }) {
  const label = migrationCountdownLabel(notice)

  if (!label) return null

  return onFilled ? (
    <Chip size='small' label={label} sx={whiteChipSx} />
  ) : (
    <Chip size='small' color='error' label={label} sx={{ fontWeight: 700 }} />
  )
}

function FactRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <i className={`${icon} text-xl`} style={{ lineHeight: 1.4 }} aria-hidden />
      <Typography variant='body1' color='inherit' component='div'>
        {children}
      </Typography>
    </Box>
  )
}

interface MigrationDeadlineBannerProps {
  notice: MigrationNotice
  draftCount: number
}

export function MigrationDeadlineBanner({ notice, draftCount }: MigrationDeadlineBannerProps) {
  const after = notice.phase === 'after'
  const hasDrafts = draftCount > 0
  const filled = after || hasDrafts

  const title = after
    ? 'A beküldési határidő lejárt'
    : hasDrafts
      ? `Fontos: ${MIGRATION_DEADLINE_SHORT} küldje be a mentett ajánlatait`
      : `${MIGRATION_SWITCH_LABEL} új rendszerre állunk át`

  return (
    <Alert
      role='region'
      aria-label='Átállás az új rendszerre'
      variant={filled ? 'filled' : 'outlined'}
      severity='error'
      sx={{ ...(filled ? filledLinkSx : {}), '& .MuiAlert-message': { width: '100%' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <AlertTitle sx={{ mb: 0 }}>{title}</AlertTitle>
        <CountdownChip notice={notice} onFilled={filled} />
      </Box>

      <Stack spacing={2}>
        {after ? (
          <Typography variant='body1' color='inherit'>
            Új megrendeléseit már az új rendszerben adhatja le. Ezen a felületen mentés és beküldés le van zárva —
            korábbi megrendelései még 3 hónapig megtekinthetők az archívumban.
          </Typography>
        ) : (
          <>
            <Typography variant='body1' color='inherit'>
              {MIGRATION_SWITCH_LABEL} egy új, sokkal gyorsabb és egyszerűbb rendszerben fogadjuk a megrendeléseket,
              ahol átláthatóbban követheti rendelései gyártását és fizetését.
              {hasDrafts &&
                ' A be nem küldött ajánlatok nem kerülnek át az új rendszerbe, ezért kérjük, a határidőig adja le őket.'}
            </Typography>

            <Typography variant='body1' color='inherit' sx={{ fontWeight: 700 }}>
              {hasDrafts
                ? `Önnek jelenleg ${draftCount} beküldetlen ajánlata van.`
                : 'Önnek nincs beküldetlen ajánlata, nincs teendője.'}
            </Typography>
          </>
        )}

        <Stack spacing={1}>
          {!after && hasDrafts && (
            <FactRow icon='ri-calendar-event-line'>
              Beküldési határidő: <strong>{MIGRATION_DEADLINE_LABEL}</strong>
            </FactRow>
          )}
          <FactRow icon='ri-login-box-line'>
            Új rendszer: <a href={NEW_SYSTEM_URL}>{NEW_SYSTEM_LABEL}</a> – ugyanazzal az e-mail címmel lép be, első
            belépéskor új jelszót állít be.
          </FactRow>
          <FactRow icon='ri-archive-line'>
            Korábbi megrendelései 3 hónapig megtekinthetők: <a href={ARCHIVE_URL}>{ARCHIVE_LABEL}</a>
          </FactRow>
        </Stack>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          {after ? (
            <Button
              component='a'
              href={NEW_SYSTEM_URL}
              variant='contained'
              sx={{ bgcolor: 'common.white', color: 'error.main', '&:hover': { bgcolor: 'grey.100' } }}
            >
              Tovább az új rendszerbe
            </Button>
          ) : hasDrafts ? (
            <Button
              component={Link}
              href='/saved'
              variant='contained'
              startIcon={<i className='ri-send-plane-line' />}
              sx={{ bgcolor: 'common.white', color: 'error.main', '&:hover': { bgcolor: 'grey.100' } }}
            >
              Mentett ajánlatok beküldése
            </Button>
          ) : null}
          <Typography variant='body1' color='inherit'>
            Kérdése van? Hívjon: <a href={`tel:${SUPPORT_PHONE_TEL}`}>{SUPPORT_PHONE_LABEL}</a>
          </Typography>
        </Box>
      </Stack>
    </Alert>
  )
}

interface MigrationDeadlineNoticeProps {
  notice: MigrationNotice
  variant?: 'filled' | 'standard'
}

export function MigrationDeadlineNotice({ notice, variant = 'filled' }: MigrationDeadlineNoticeProps) {
  const filled = variant === 'filled'

  return (
    <Alert
      role='region'
      aria-label='Beküldési határidő'
      variant={variant}
      severity='error'
      sx={filled ? filledLinkSx : undefined}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant='body1' color='inherit' sx={{ fontWeight: 600 }}>
          {notice.phase === 'after' ? (
            <>
              A beküldési határidő lejárt. Új megrendeléseit a <a href={NEW_SYSTEM_URL}>{NEW_SYSTEM_LABEL}</a> címen
              adhatja le.
            </>
          ) : (
            <>
              Beküldési határidő: {MIGRATION_DEADLINE_LABEL}. {MIGRATION_SWITCH_LABEL} új rendszerre állunk át, a be nem
              küldött ajánlatok nem kerülnek át.
            </>
          )}
        </Typography>
        <CountdownChip notice={notice} onFilled={filled} />
      </Box>
    </Alert>
  )
}
