import { Text, View } from 'react-native'

import type { BelepokDevice } from '@/lib/belepok'
import { colors } from '@/theme'
import { Card } from '@/ui'

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (min < 1) return 'most'
  if (min < 60) return `${min} perce`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} órája`
  return `${Math.round(h / 24)} napja`
}

/** Belépőszámláló állapota: mindig egy sor, kiesésnél figyelmeztető kártya. */
export function DeviceStatus({ device }: { device: BelepokDevice }) {
  if (device.status === 'none') {
    return (
      <Text className="px-1 text-[12px] text-muted-foreground">
        Nincs bekötött belépőszámláló.
      </Text>
    )
  }

  if (device.status === 'live') {
    return (
      <View className="flex-row items-center gap-1.5 px-1">
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.presenceIn }}
        />
        <Text className="text-[12px] font-medium text-foreground">Élő</Text>
        <Text className="text-[12px] text-muted-foreground">
          · {device.lastSeenAt ? `${ago(device.lastSeenAt)} frissült` : 'adatot küld'}
        </Text>
      </View>
    )
  }

  const since = device.lastSeenAt ? ago(device.lastSeenAt) : null
  return (
    <Card tone="warning">
      <Text className="text-[14px] font-semibold text-warning-foreground">
        {since
          ? `A számláló ${since} nem küldött adatot.`
          : 'A számláló még nem küldött adatot.'}
      </Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">
        Az ez utáni számok hiányosak lehetnek. Nézd meg, hogy az eszköz be van-e
        dugva, és van-e internet.
      </Text>
    </Card>
  )
}
