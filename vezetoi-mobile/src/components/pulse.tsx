import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CloudOff,
  Info,
  type LucideIcon
} from 'lucide-react-native'

import { formatClock, type Delta } from '@/lib/format'
import { colors } from '@/theme'
import { Skeleton } from '@/ui'
import { cn } from '@/ui/cn'

/**
 * Kezdőlap „csendes rács”: 4 betűméret (40 / 28 / 15 / 13), fekete szám, szürke
 * felirat, szürke ikon. Szín csak állapotot jelez, mindig jellel + szöveggel.
 */

const SURFACE = 'rounded-2xl border border-border bg-card p-4'
const NUM = { fontVariant: ['tabular-nums' as const] }

function Pressed({
  onPress,
  label,
  className,
  children
}: {
  onPress?: () => void
  label: string
  className?: string
  children: ReactNode
}) {
  if (!onPress) return <View className={className}>{children}</View>
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={className}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
    >
      {children}
    </Pressable>
  )
}

function Header({
  icon: Icon,
  label,
  chevron
}: {
  icon?: LucideIcon
  label: string
  chevron: boolean
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      {Icon ? <Icon size={16} color={colors.inkMuted} strokeWidth={2} /> : null}
      <Text className="flex-1 text-[13px] font-medium text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      {chevron ? <ChevronRight size={16} color={colors.inkMuted} /> : null}
    </View>
  )
}

/** Csoport: cím + kártyák 12px-re; csoportok között a képernyő 24px-e. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="px-1 text-[15px] font-semibold text-foreground" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
}

export function HeroCard({
  icon,
  label,
  value,
  footer,
  onPress
}: {
  icon?: LucideIcon
  label: string
  value: string
  footer: ReactNode
  onPress?: () => void
}) {
  return (
    <Pressed onPress={onPress} label={label} className={cn(SURFACE, 'gap-1')}>
      <Header icon={icon} label={label} chevron={!!onPress} />
      <Text
        className="text-[40px] font-bold text-foreground"
        style={[NUM, { letterSpacing: -1 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      {footer}
    </Pressed>
  )
}

/** Fix magasságú csempe: felirat · szám · lábsor. Egy sorban mindig kettő. */
export function Tile({
  icon,
  label,
  value,
  footer,
  onPress
}: {
  icon?: LucideIcon
  label: string
  value: string
  footer: ReactNode
  onPress?: () => void
}) {
  return (
    <Pressed
      onPress={onPress}
      label={label}
      className={cn(SURFACE, 'h-[128px] flex-1 justify-between')}
    >
      <Header icon={icon} label={label} chevron={!!onPress} />
      <Text
        className="text-[28px] font-bold text-foreground"
        style={[NUM, { letterSpacing: -0.6 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <View className="gap-1.5">{footer}</View>
    </Pressed>
  )
}

/** Lábsor szöveg: alapból szürke; állapotnál zöld/borostyán (a jel a szövegben van). */
export function FooterText({
  children,
  tone = 'muted'
}: {
  children: string
  tone?: 'muted' | 'success' | 'warning'
}) {
  const cls =
    tone === 'success'
      ? 'text-success-foreground font-medium'
      : tone === 'warning'
        ? 'text-warning-foreground font-medium'
        : 'text-muted-foreground'
  return (
    <Text className={cn('text-[13px]', cls)} style={NUM} numberOfLines={1}>
      {children}
    </Text>
  )
}

/** Delta két sorban: „▲ 18% · +158 000 Ft” (színes, jellel) + „a szokásos csütörtökhöz képest”. */
export function DeltaFooter({ delta, label }: { delta: Delta; label: string | null }) {
  return (
    <View className="gap-0.5">
      <FooterText tone={delta.tone}>{delta.text}</FooterText>
      {label && delta.text !== 'Nincs összevetési adat' ? <FooterText>{label}</FooterText> : null}
    </View>
  )
}

/** Hálózati hiba, de van korábbi adat: borostyán sáv, hogy ne higgye frissnek. */
export function StaleStrip({ updatedAt }: { updatedAt: number | null }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3 py-2">
      <CloudOff size={16} color={colors.warning} />
      <Text className="flex-1 text-[13px] font-medium text-warning-foreground">
        {updatedAt
          ? `Nem sikerült frissíteni — a ${formatClock(updatedAt)}-es adatot látod.`
          : 'Nem sikerült betölteni. Húzd le az újrapróbáláshoz.'}
      </Text>
    </View>
  )
}

/** „Mit számolunk ide?” — összecsukható definíció a részletezők alján. */
export function ExplainCard({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      className="gap-2 rounded-xl border border-border bg-card px-4 py-3"
    >
      <View className="flex-row items-center gap-2">
        <Info size={16} color={colors.inkMuted} />
        <Text className="flex-1 text-[14px] font-medium text-foreground">Mit számolunk ide?</Text>
        {open ? (
          <ChevronUp size={16} color={colors.inkMuted} />
        ) : (
          <ChevronDown size={16} color={colors.inkMuted} />
        )}
      </View>
      {open
        ? lines.map((l) => (
            <Text key={l} className="text-[13px] leading-[19px] text-muted-foreground">
              {l}
            </Text>
          ))
        : null}
    </Pressable>
  )
}

/** Vékony kapacitás sáv: fekete, betelve (100%+) borostyán. */
export function ThinBar({ pct }: { pct: number }) {
  const warn = pct >= 100
  return (
    <View
      className="h-1.5 overflow-hidden rounded-full bg-secondary"
      accessibilityLabel={`${pct}%`}
    >
      <View
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: warn ? colors.warning : colors.ink
        }}
      />
    </View>
  )
}

export function DetailSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-4 w-28" label="Betöltés" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </View>
  )
}
