import { Text, View } from 'react-native'
import { CalendarOff } from 'lucide-react-native'

import type { JelenletHolidayBanner } from '@/lib/jelenlet'
import { colors } from '@/theme'
import { Card } from '@/ui'

type Props = {
  holiday: JelenletHolidayBanner
}

/** Nap szintű ünnep / pihenő — ikon + szöveg, nem szín-only. */
export function JelenletHolidayBannerView({ holiday }: Props) {
  return (
    <Card className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
        <CalendarOff size={18} color={colors.ink} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-foreground">{holiday.title}</Text>
        {holiday.name ? (
          <Text className="text-[13px] text-muted-foreground">{holiday.name}</Text>
        ) : null}
      </View>
    </Card>
  )
}
