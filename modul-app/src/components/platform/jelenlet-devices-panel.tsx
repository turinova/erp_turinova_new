'use client'

import {
  createJelenletDevicePlatform,
  deleteJelenletDevicePlatform,
  rotateJelenletDeviceTokenPlatform,
  updateJelenletDevicePlatform
} from '@/lib/jelenlet/platform-device-actions'
import type { JelenletDeviceRow } from '@/lib/jelenlet/types'
import { JelenletDevicesPanel } from '@/components/jelenlet/jelenlet-devices-panel'

export function PlatformJelenletDevicesPanel({
  tenantId,
  devices,
  addonEnabled
}: {
  tenantId: string
  devices: JelenletDeviceRow[]
  addonEnabled: boolean
}) {
  return (
    <JelenletDevicesPanel
      devices={devices}
      addonEnabled={addonEnabled}
      title="Jelenlét — terminálok"
      hint={
        <>
          Csak platform: hardvert mi telepítjük. Token egyszer látszik. Endpoint:{' '}
          <code className="text-[12px]">/api/jelenlet/terminal/scan</code>
        </>
      }
      actions={{
        create: (input) =>
          createJelenletDevicePlatform({ tenantId, ...input }),
        rotate: (deviceId) =>
          rotateJelenletDeviceTokenPlatform({ tenantId, deviceId }),
        update: (input) =>
          updateJelenletDevicePlatform({ tenantId, ...input }),
        remove: (deviceId) =>
          deleteJelenletDevicePlatform({ tenantId, deviceId })
      }}
    />
  )
}
