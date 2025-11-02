'use client'

const Logo = ({ color }: { color?: string }) => {
  return (
    <div className='flex items-center min-bs-[24px]'>
      <img
        src='/images/turinova-logo.png'
        alt='Turinova Logo'
        style={{ width: '160px', height: 'auto' }}
      />
    </div>
  )
}

export default Logo

