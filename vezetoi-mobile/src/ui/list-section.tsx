import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Text, View } from 'react-native'

import { Separator } from './separator'

type Props = {
  title?: string
  footer?: string
  children: ReactNode
}

/** iOS / Notion csoportos lista: halk cím, egy hairline keret, sorok között beljebb húzott vonal. */
export function ListSection({ title, footer, children }: Props) {
  const rows = Children.toArray(children).filter(isValidElement)
  if (rows.length === 0) return null

  return (
    <View className="gap-1.5">
      {title ? (
        <Text className="px-1 text-[13px] font-medium text-muted-foreground">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <Separator inset /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text className="px-1 text-[12px] leading-4 text-muted-foreground">
          {footer}
        </Text>
      ) : null}
    </View>
  )
}
