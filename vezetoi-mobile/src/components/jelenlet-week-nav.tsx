import { useMemo, useState } from 'react'
import { Modal, Platform, Pressable, Text, View } from 'react-native'
import DateTimePicker, {
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { WeekStrip } from 'panelui-native/components/week-strip'

import { addDaysYmd } from '@/lib/date'
import {
  jelenletClampYmd,
  jelenletRangeBounds,
  localDateToYmd,
  ymdToLocalDate
} from '@/lib/jelenlet'
import { colors } from '@/theme'

const MONTH_SHORT = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.'
] as const

/** Hétfő (YMD) a megadott nap hetéből. */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return addDaysYmd(ymd, -((wd + 6) % 7))
}

function weekLabel(monday: string): string {
  const sunday = addDaysYmd(monday, 6)
  const [, m1, d1] = monday.split('-').map(Number)
  const [, m2, d2] = sunday.split('-').map(Number)
  if (m1 === m2) return `${MONTH_SHORT[m1 - 1]} ${d1}–${d2}.`
  return `${MONTH_SHORT[m1 - 1]} ${d1}. – ${MONTH_SHORT[m2 - 1]} ${d2}.`
}

type Props = {
  ymd: string
  /** Mai nap (BP) — a hívó frissíti éjfélkor. */
  today: string
  /** YMD → hány ember jelent meg aznap (érkezés rögzítve). */
  presentByDay: Map<string, number>
  onSelectYmd: (ymd: string) => void
}

/** Hét fejléc (‹ hét › + naptár) és a hét napjai csempeként, alattuk a megjelentek száma. */
export function JelenletWeekNav({ ymd, today, presentByDay, onSelectYmd }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ymdToLocalDate(ymd))
  const { earliest, latest } = useMemo(() => jelenletRangeBounds(today), [today])

  const monday = mondayOf(ymd)
  const canPrevWeek = addDaysYmd(monday, -1) >= earliest
  const canNextWeek = addDaysYmd(monday, 7) <= latest

  const go = (next: string) => onSelectYmd(jelenletClampYmd(next))

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false)
      if (event.type === 'dismissed' || !date) return
      go(localDateToYmd(date))
      return
    }
    if (date) setDraft(date)
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center">
        <Pressable
          disabled={!canPrevWeek}
          onPress={() => go(addDaysYmd(ymd, -7))}
          className="h-8 w-8 items-center justify-center"
          style={{ opacity: canPrevWeek ? 1 : 0.3 }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Előző hét"
        >
          <ChevronLeft size={18} color={colors.ink} />
        </Pressable>

        <Pressable
          onPress={() => {
            setDraft(ymdToLocalDate(ymd))
            setOpen(true)
          }}
          className="flex-1 flex-row items-center justify-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Dátum választása"
        >
          <CalendarDays size={15} color={colors.inkMuted} />
          <Text className="text-[15px] font-semibold text-foreground">
            {weekLabel(monday)}
          </Text>
        </Pressable>

        {ymd !== today ? (
          <Pressable
            onPress={() => go(today)}
            className="mr-1 rounded-md border border-border bg-card px-2 py-1"
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Ugrás a mai napra"
          >
            <Text className="text-[12px] font-semibold text-foreground">Ma</Text>
          </Pressable>
        ) : null}

        <Pressable
          disabled={!canNextWeek}
          onPress={() => go(addDaysYmd(ymd, 7))}
          className="h-8 w-8 items-center justify-center"
          style={{ opacity: canNextWeek ? 1 : 0.3 }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Következő hét"
        >
          <ChevronRight size={18} color={colors.ink} />
        </Pressable>
      </View>

      <WeekStrip
        value={ymdToLocalDate(ymd)}
        onValueChange={(d) => go(localDateToYmd(d))}
        weekStartsOn={1}
        locale="hu-HU"
        today={ymdToLocalDate(today)}
        disabled={(d) => {
          const key = localDateToYmd(d)
          return key > latest || key < earliest
        }}
        marks={(d) => {
          const key = localDateToYmd(d)
          if (key > latest) return undefined
          const n = presentByDay.get(key) ?? 0
          return n > 0 ? { label: `${n} fő` } : undefined
        }}
      />

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={ymdToLocalDate(ymd)}
          mode="date"
          display="default"
          onChange={onPickerChange}
          minimumDate={ymdToLocalDate(earliest)}
          maximumDate={ymdToLocalDate(latest)}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            className="flex-1 justify-end"
            style={{ backgroundColor: 'rgba(24,24,27,0.35)' }}
            onPress={() => setOpen(false)}
          >
            <Pressable
              className="rounded-t-xl bg-card pb-4"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text className="text-[15px] text-muted-foreground">Mégse</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setOpen(false)
                    go(localDateToYmd(draft))
                  }}
                  hitSlop={8}
                >
                  <Text className="text-[15px] font-bold text-foreground">Kész</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                onChange={onPickerChange}
                minimumDate={ymdToLocalDate(earliest)}
                maximumDate={ymdToLocalDate(latest)}
                locale="hu-HU"
                style={{ height: 180, alignSelf: 'center' }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}
