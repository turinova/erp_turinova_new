'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

// Util Imports
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useHorizontalNav()

  return (
    <div
      className={classnames(horizontalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <p>
        <span className='text-textSecondary'>{`© ${new Date().getFullYear()}, Made with `}</span>
        <span>{`❤️`}</span>
        <span className='text-textSecondary'>{` by `}</span>
        <span className='text-primary uppercase'>
          Turinova
        </span>
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
      </p>
    </div>
  )
}

export default FooterContent
