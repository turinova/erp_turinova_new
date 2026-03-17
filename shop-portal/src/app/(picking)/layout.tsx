import type { ChildrenType } from '@core/types'
import Providers from '@components/Providers'

export default async function PickingLayout(props: ChildrenType) {
  const { children } = props
  return (
    <Providers direction="ltr">
      <div
        style={{
          minHeight: '100dvh',
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--mui-palette-background-default)',
          position: 'fixed',
          inset: 0,
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </Providers>
  )
}
