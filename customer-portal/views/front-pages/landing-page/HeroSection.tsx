// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Squares from '@/components/Squares'
import Curve from '@assets/svg/front-pages/landing-page/Curve'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

const HeroSection = ({ mode }: { mode: Mode }) => {
  // Hooks
  const isAboveMdScreen = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'))

  return (
    <section 
      id='home' 
      className='relative w-full -mbs-[70px] pt-[70px] bg-backgroundPaper' 
      style={{ height: '600px', overflow: 'visible' }}
    >
      {/* Mosaic background - full width, only on desktop */}
      <div className='absolute inset-0 z-0' style={{ overflow: 'hidden' }}>
        {isAboveMdScreen && (
          <Squares
            squareSize={40}
            borderColor='#666'
            hoverFillColor='#333'
          />
        )}
      </div>

      {/* Content absolutely centered on top of mosaic */}
      <div 
        className='absolute inset-0 flex items-center justify-center z-10'
        style={{ 
          top: '70px',
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none'
        }}
      >
        <div className={classnames('text-center px-6', frontCommonStyles.layoutSpacing)} style={{ pointerEvents: 'auto' }}>
          <div 
            className='md:max-is-[800px] mx-auto p-8 rounded-lg'
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at center, black 60%, transparent 120%)',
              maskImage: 'radial-gradient(ellipse 100% 100% at center, black 60%, transparent 120%)',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
          >
            <Typography className='font-extrabold text-primary sm:text-[38px] text-3xl mbe-4 leading-[44px]'>
              Vállalatirányítási szoftver kifejezetten asztalos cégekre optimalizálva
            </Typography>
            <Typography className='font-medium' color='text.primary'>
              Hatékony termelésirányítás, készletkezelés és árajánlatkészítés. Mindent egy helyen, amit egy modern asztalos üzemnek szüksége van.
            </Typography>
          </div>
        </div>
      </div>

      {/* Curved bottom overlay - SVG wave shape with shadow */}
      <div className='absolute bottom-0 left-0 right-0 z-[2]' style={{ lineHeight: 0, transform: 'translateY(1px)', filter: 'drop-shadow(0 -4px 6px rgba(0, 0, 0, 0.15))' }}>
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 120' fill='none' preserveAspectRatio='none' style={{ width: '100%', height: 'auto' }}>
          <path 
            d='M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z' 
            fill='var(--mui-palette-background-paper)'
          />
        </svg>
      </div>
    </section>
  )
}

export default HeroSection
