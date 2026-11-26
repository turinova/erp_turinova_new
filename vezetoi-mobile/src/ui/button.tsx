import type { ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import { Button as PanelButton } from 'panelui-native/components/button'

type Variant = 'default' | 'secondary' | 'destructive' | 'ghost'

type Props = {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: Variant
  style?: ViewStyle
}

/** Destruktív = soft piros (nem tömör) — Midday: a piros a jelentés, nem a felület. */
const VARIANT = {
  default: { variant: 'primary', className: undefined, labelClassName: undefined },
  secondary: { variant: 'outline', className: undefined, labelClassName: undefined },
  destructive: {
    variant: 'outline',
    className: 'border-destructive/25 bg-destructive-soft',
    labelClassName: 'text-destructive-foreground font-semibold'
  },
  ghost: { variant: 'ghost', className: undefined, labelClassName: undefined }
} as const

export function Button({
  children,
  onPress,
  disabled,
  loading,
  variant = 'default',
  style
}: Props) {
  const v = VARIANT[variant]
  return (
    <PanelButton
      variant={v.variant}
      size="md"
      fullWidth
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      className={v.className}
      labelClassName={v.labelClassName ?? 'font-semibold'}
      style={style}
    >
      {children}
    </PanelButton>
  )
}
