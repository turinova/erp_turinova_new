import { Text, View } from 'react-native'

import { useFlags } from '@/features/tenant/flags-context'
import { Button, Card, Screen, Skeleton } from '@/ui'

/** Amíg a cég moduljai nem ismertek: skeleton, hibánál újrapróbálás. */
export function FlagsPending() {
  const { failed, loading, refresh } = useFlags()

  if (failed) {
    return (
      <Screen>
        <Card tone="danger">
          <Text className="text-[14px] font-semibold text-destructive-foreground">
            Nem sikerült betölteni a cég adatait.
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            Nézd meg a hálózatot, és próbáld újra.
          </Text>
          <Button loading={loading} onPress={() => void refresh()}>
            Újrapróbálás
          </Button>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen>
      <View className="gap-3">
        <Skeleton className="h-10 w-full rounded-xl" label="Betöltés" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </View>
    </Screen>
  )
}
