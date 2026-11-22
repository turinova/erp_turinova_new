import { Eye, EyeOff } from 'lucide-react-native'
import { forwardRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps
} from 'react-native'

import { colors, radius, space } from '@/theme'

type Props = Omit<TextInputProps, 'secureTextEntry'>

export const PasswordInput = forwardRef<TextInput, Props>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <View style={styles.wrap}>
        <TextInput
          ref={ref as never}
          placeholderTextColor={colors.inkMuted}
          {...props}
          secureTextEntry={!visible}
          style={[styles.input, props.style]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            visible ? 'Jelszó elrejtése' : 'Jelszó mutatása'
          }
          hitSlop={8}
          onPress={() => setVisible((v) => !v)}
          style={styles.toggle}
        >
          {visible ? (
            <EyeOff size={18} color={colors.inkMuted} strokeWidth={2} />
          ) : (
            <Eye size={18} color={colors.inkMuted} strokeWidth={2} />
          )}
        </Pressable>
      </View>
    )
  }
)

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingRight: 44,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface
  },
  toggle: {
    position: 'absolute',
    right: 0,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
