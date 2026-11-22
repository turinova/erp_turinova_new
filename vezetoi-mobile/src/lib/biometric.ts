import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const LOCK_KEY = 'vezetoi.biometricLock'

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return false
  return LocalAuthentication.isEnrolledAsync()
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(LOCK_KEY)
  return v === '1'
}

export async function setBiometricLockEnabled(on: boolean): Promise<void> {
  if (on) await SecureStore.setItemAsync(LOCK_KEY, '1')
  else await SecureStore.deleteItemAsync(LOCK_KEY)
}

/** Első sikeres jelszavas belépés után: ha van Face ID / ujjlenyomat, kapcsold be. */
export async function enableBiometricLockIfAvailable(): Promise<boolean> {
  const ok = await isBiometricHardwareAvailable()
  if (!ok) return false
  await setBiometricLockEnabled(true)
  return true
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Oldd fel a vezetői appot',
    cancelLabel: 'Mégse',
    disableDeviceFallback: false,
    fallbackLabel: 'Jelszó'
  })
  return result.success
}

export async function biometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
  if (
    types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    )
  ) {
    return 'Face ID'
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Ujjlenyomat'
  }
  return 'Biometria'
}
