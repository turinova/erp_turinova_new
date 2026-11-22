import { useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native'
import DateTimePicker, {
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native'

import {
  jelenletClampYmd,
  jelenletRangeBounds,
  localDateToYmd,
  ymdToLocalDate
} from '@/lib/jelenlet'
import { colors, radius, space } from '@/theme'

type Props = {
  ymd: string
  label: string
  isToday: boolean
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  onSelectYmd: (ymd: string) => void
  onToday: () => void
}

/**
 * Egy sor: ‹ | dátum (picker) | Ma? | ›
 * Extra magasság csak iOS spinner modalban.
 */
export function JelenletDayNav({
  ymd,
  label,
  isToday,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onSelectYmd,
  onToday
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ymdToLocalDate(ymd))

  const { minDate, maxDate } = useMemo(() => {
    const { earliest, latest } = jelenletRangeBounds()
    return {
      minDate: ymdToLocalDate(earliest),
      maxDate: ymdToLocalDate(latest)
    }
  }, [])

  const openPicker = () => {
    setDraft(ymdToLocalDate(ymd))
    setOpen(true)
  }

  const applyYmd = (nextYmd: string) => {
    onSelectYmd(jelenletClampYmd(nextYmd))
    setOpen(false)
  }

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false)
      if (event.type === 'dismissed' || !date) return
      applyYmd(localDateToYmd(date))
      return
    }
    if (date) setDraft(date)
  }

  return (
    <>
      <View style={styles.row}>
        <Pressable
          disabled={!canGoPrev}
          onPress={onPrev}
          style={[styles.hit, !canGoPrev && styles.hitDisabled]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Előző nap"
        >
          <ChevronLeft size={18} color={colors.ink} />
        </Pressable>

        <View style={styles.center}>
          <Pressable
            onPress={openPicker}
            style={styles.dateHit}
            accessibilityRole="button"
            accessibilityLabel="Dátum választása"
          >
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            <ChevronDown size={14} color={colors.inkMuted} strokeWidth={2.5} />
          </Pressable>

          {!isToday ? (
            <Pressable
              onPress={onToday}
              style={styles.todayChip}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Ugrás a mai napra"
            >
              <Text style={styles.todayText}>Ma</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          disabled={!canGoNext}
          onPress={onNext}
          style={[styles.hit, !canGoNext && styles.hitDisabled]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Következő nap"
        >
          <ChevronRight size={18} color={colors.ink} />
        </Pressable>
      </View>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={ymdToLocalDate(ymd)}
          mode="date"
          display="default"
          onChange={onChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetBar}>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text style={styles.sheetCancel}>Mégse</Text>
                </Pressable>
                <Pressable
                  onPress={() => applyYmd(localDateToYmd(draft))}
                  hitSlop={8}
                >
                  <Text style={styles.sheetDone}>Kész</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                onChange={onChange}
                minimumDate={minDate}
                maximumDate={maxDate}
                locale="hu-HU"
                style={styles.iosPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36
  },
  hit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  hitDisabled: {
    opacity: 0.3
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minWidth: 0
  },
  dateHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: '78%',
    paddingVertical: 4,
    paddingHorizontal: 4
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    flexShrink: 1
  },
  todayChip: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface
  },
  todayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24,24,27,0.35)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: space[4]
  },
  sheetBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[1]
  },
  sheetCancel: {
    fontSize: 15,
    color: colors.inkSecondary
  },
  sheetDone: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink
  },
  iosPicker: {
    height: 180,
    alignSelf: 'center'
  }
})
