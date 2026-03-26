import type { ReactNode } from 'react'

type PosLayoutProps = {
  children: ReactNode
}

export default function PosLayout({ children }: PosLayoutProps) {
  return (
    <>
      <style>{`
        .ts-vertical-layout-header,
        .ts-horizontal-layout-header,
        .ts-horizontal-layout-navigation {
          display: none !important;
        }

        .ts-vertical-layout-footer,
        .ts-horizontal-layout-footer {
          display: none !important;
        }
      `}</style>
      {children}
    </>
  )
}

