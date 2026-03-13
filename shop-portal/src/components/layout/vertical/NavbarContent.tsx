'use client'

// Third-party Imports
import classnames from 'classnames'
import NextLink from 'next/link'

// MUI Imports
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'

// Component Imports
import NavToggle from './NavToggle'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'
import { CreditBalance } from '@/components/CreditBalance'
import { SyncProgressIndicator } from '@/components/SyncProgressIndicator'
import { useBufferCount } from '@/hooks/useBufferCount'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const NavbarContent = () => {
  const bufferCount = useBufferCount()

  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-4'>
        <NavToggle />
        <ModeDropdown />
        {bufferCount > 0 && (
          <Link
            component={NextLink}
            href='/orders/buffer'
            underline='none'
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--mui-palette-text-secondary)' }}>
              Feldolgozásra váró rendelések:
            </span>
            <Chip
              label={bufferCount}
              size='small'
              color='error'
              sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
            />
          </Link>
        )}
      </div>
      <div className='flex items-center gap-4'>
        <SyncProgressIndicator />
        <CreditBalance compact={true} />
        <UserDropdown />
      </div>
    </div>
  )
}

export default NavbarContent
