import { Button as PanelButton } from 'panelui-native/components/button'
import { Dialog } from 'panelui-native/components/dialog'
import { View } from 'react-native'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
  loading?: boolean
}

/** Megerősítés: Mégse balra, a művelet jobbra (primary action jobbra). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  loading
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content blur>
        <Dialog.Title>{title}</Dialog.Title>
        {description ? <Dialog.Description>{description}</Dialog.Description> : null}
        <Dialog.Footer>
          <View className="flex-1">
            <PanelButton
              variant="outline"
              fullWidth
              onPress={() => onOpenChange(false)}
              labelClassName="font-semibold"
            >
              Mégse
            </PanelButton>
          </View>
          <View className="flex-1">
            <PanelButton
              variant={destructive ? 'destructive' : 'primary'}
              fullWidth
              loading={loading}
              onPress={onConfirm}
              labelClassName="font-semibold"
            >
              {confirmLabel}
            </PanelButton>
          </View>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
