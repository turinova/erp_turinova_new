'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useVerticalNav()

  return (
    <div
      className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <p>
        <span className='text-textSecondary'>{`© ${new Date().getFullYear()} Turinova`}</span>
        <span className='text-textSecondary'>{` | `}</span>
        <a 
          href='mailto:info@turinova.hu'
          className='text-primary hover:underline'
        >
          info@turinova.hu
        </a>
        <span className='text-textSecondary'>{` | `}</span>
        <Link 
          href='/terms-and-conditions' 
          target='_blank' 
          rel='noopener noreferrer'
          className='text-primary hover:underline'
        >
          ÁSZF
        </Link>
        <span className='text-textSecondary'>{` | `}</span>
        <Link 
          href='/privacy-policy' 
          target='_blank' 
          rel='noopener noreferrer'
          className='text-primary hover:underline'
        >
          Adatkezelési tájékoztató
        </Link>
        <span className='text-textSecondary'>{` | `}</span>
        <Link 
          href='/cookie-policy' 
          target='_blank' 
          rel='noopener noreferrer'
          className='text-primary hover:underline'
        >
          Süti szabályzat
        </Link>
      </p>
    </div>
  )
}

export default FooterContent
