# Layout Debug - Port 3001 vs 3000

## Current Status
- ✅ Both servers running (3000 and 3001)
- ✅ Customer portal compiling successfully (`GET / 200`)
- ❌ Visual layout not matching

## Component Tree Comparison

### Main App (3000)
```
<html id='__next'>                    → display: flex; min-block-size: 100%
  <body className='flex is-full min-bs-full flex-auto flex-col'>
    <Providers direction='ltr'>
      <BlankLayout>                   → className='ts-blank-layout is-full bs-full'
        <LandingPage mode={mode}>
          <div className='flex items-center justify-center bs-full relative p-6'>
            <div className='flex items-center flex-col gap-10'>
              [Content: Logo, Text, Button]
            </div>
            <img className='absolute bottom-0 z-[-1] is-full' />
          </div>
        </LandingPage>
      </BlankLayout>
    </Providers>
  </body>
</html>
```

### Customer Portal (3001)
```
<html id='__next'>                    → display: flex; min-block-size: 100%
  <body className='flex is-full min-bs-full flex-auto flex-col'>
    <Providers direction='ltr'>
      <BlankLayout>                   → className='ts-blank-layout is-full bs-full'
        <LandingPage mode={mode}>
          <div className='flex items-center justify-center bs-full relative p-6'>
            <div className='flex items-center flex-col gap-10'>
              [Content: Logo, Text, 2 Buttons]
            </div>
            <img className='absolute bottom-0 z-[-1] is-full' />
          </div>
        </LandingPage>
      </BlankLayout>
    </Providers>
  </body>
</html>
```

## Key Classes Explained

### Tailwind Logical Classes (from tailwindcss-logical)
- `is-full` = `inline-size: 100%` = width: 100%
- `bs-full` = `block-size: 100%` = height: 100%
- `min-bs-full` = `min-block-size: 100%` = min-height: 100%

### Expected Behavior
1. HTML: min-height 100% of viewport
2. Body: flex container, min-height 100%, auto grow
3. BlankLayout wrapper: 100% width AND height
4. LandingPage container: 100% height
5. Background image: positioned at bottom, 100% width, natural height

## Files to Check

### Customer Portal
- ✅ `/customer-portal/app/layout.tsx` - Root layout
- ✅ `/customer-portal/app/(blank-layout-pages)/layout.tsx` - Group layout with Providers
- ✅ `/customer-portal/app/(blank-layout-pages)/page.tsx` - Page wrapper
- ✅ `/customer-portal/views/LandingPage.tsx` - Landing component
- ✅ `/customer-portal/layouts/BlankLayout.tsx` - Blank layout wrapper
- ✅ `/customer-portal/app/globals.css` - Global styles
- ✅ `/customer-portal/core/tailwind/plugin.ts` - Tailwind plugin
- ✅ `/customer-portal/tailwind.config.ts` - Tailwind config

## Potential Issues

1. **CSS not loading**: Check if globals.css is actually being applied
2. **Tailwind not generating classes**: Check if tailwindcss-logical is working
3. **Component not hydrating**: Check for React hydration errors
4. **Image path wrong**: Verify `/images/pages/misc-mask-1-light.png` exists
5. **Z-index conflict**: Something might be rendering on top of the image

## Next Steps to Debug

1. Open browser DevTools on both ports
2. Inspect the `<body>` element - check computed styles
3. Check if `bs-full` class is actually being applied
4. Check if the BlankLayout div has the correct classes
5. Check if the LandingPage container div has `bs-full`
6. Measure the actual heights in pixels

## Quick Visual Check

### What SHOULD be identical:
- ✅ Font (Inter)
- ✅ Logo size (80px height)
- ✅ Background color
- ✅ Background image positioning
- ✅ Content centering
- ✅ Full viewport height (no white space)

### What's DIFFERENT:
- Title text
- Subtitle text
- Number of buttons (1 vs 2)

