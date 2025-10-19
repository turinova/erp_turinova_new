'use client'

const Logo = () => {

  return (
    <div className='flex items-center min-bs-[24px]'>
      <img 
        src='/images/turinova-logo.png' 
        alt='Turinova Logo' 
        style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}

export default Logo
