import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

export function Separator() {
  return <View style={styles.line} />
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    width: '100%'
  }
})
