'use client'

import { cn } from '@/lib/utils'

export type PdaKbLayer = 'lower' | 'upper' | 'num'

type Props = {
  layer: PdaKbLayer
  onLayerChange: (layer: PdaKbLayer) => void
  onKey: (key: string) => void
  onBackspace: () => void
  disabled?: boolean
  className?: string
}

const ROW_LOWER = [
  ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['y', 'x', 'c', 'v', 'b', 'n', 'm'],
  ['á', 'é', 'í', 'ó', 'ö', 'ő', 'ú', 'ü', 'ű']
] as const

const ROW_UPPER = [
  ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Y', 'X', 'C', 'V', 'B', 'N', 'M'],
  ['Á', 'É', 'Í', 'Ó', 'Ö', 'Ő', 'Ú', 'Ü', 'Ű']
] as const

const ROW_NUM = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', '.', ',', '+', '%', '#', '*', '(', ')'],
  ["'", '"', ':', ';', '!', '?', '@', '&']
] as const

function KeyBtn({
  label,
  onClick,
  disabled,
  className,
  wide
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  wide?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 min-w-0 items-center justify-center rounded-md border border-border bg-surface text-[15px] font-semibold text-ink active:bg-subtle disabled:opacity-50',
        wide ? 'flex-[1.6]' : 'flex-1',
        className
      )}
    >
      {label}
    </button>
  )
}

/**
 * PDA in-app soft keyboard — HU letters + accents as own keys (no OS SIP / wedge clash).
 */
export function PdaSoftKeyboard({
  layer,
  onLayerChange,
  onKey,
  onBackspace,
  disabled,
  className
}: Props) {
  const rows =
    layer === 'num' ? ROW_NUM : layer === 'upper' ? ROW_UPPER : ROW_LOWER

  return (
    <div className={cn('space-y-1.5', className)}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((k) => (
            <KeyBtn
              key={k}
              label={k}
              disabled={disabled}
              onClick={() => onKey(k)}
            />
          ))}
        </div>
      ))}
      <div className="flex gap-1">
        {layer === 'num' ? (
          <KeyBtn
            label="ABC"
            disabled={disabled}
            wide
            className="bg-subtle"
            onClick={() => onLayerChange('lower')}
          />
        ) : (
          <>
            <KeyBtn
              label={layer === 'upper' ? 'abc' : 'ABC'}
              disabled={disabled}
              wide
              className="bg-subtle"
              onClick={() =>
                onLayerChange(layer === 'upper' ? 'lower' : 'upper')
              }
            />
            <KeyBtn
              label="123"
              disabled={disabled}
              wide
              className="bg-subtle"
              onClick={() => onLayerChange('num')}
            />
          </>
        )}
        <KeyBtn
          label="␣"
          disabled={disabled}
          wide
          className="flex-[3]"
          onClick={() => onKey(' ')}
        />
        <KeyBtn
          label="⌫"
          disabled={disabled}
          wide
          className="bg-subtle"
          onClick={onBackspace}
        />
      </div>
    </div>
  )
}
