import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { useCallback, useState } from 'react'
import { Linking } from 'react-native'

import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import { WEB_ORIGIN } from '@/lib/api'
import { TENANT_ROLE_LABELS } from '@/lib/memberships'
import { ConfirmDialog, ListRow, ListSection, Screen } from '@/ui'

const SUPPORT_EMAIL = 'info@turinova.hu'
const PRIVACY_URL = `${WEB_ORIGIN}/adatkezelesi-tajekoztato`
const APP_VERSION = Constants.expoConfig?.version ?? ''

export default function TobbScreen() {
  const { user, current, memberships, selectTenant, signOut, refreshMemberships } =
    useAuth()
  const { refresh: refreshFlags } = useFlags()
  const [refreshing, setRefreshing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshMemberships()
      await refreshFlags()
    } finally {
      setRefreshing(false)
    }
  }, [refreshMemberships, refreshFlags])

  if (!current) return null

  const multi = memberships.length > 1

  return (
    <>
      <Screen
        title="Több"
        subtitle={user?.email}
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
      >
        <ListSection
          title="Cég"
          footer={
            multi
              ? 'A számaid a kiválasztott céghez tartoznak. Koppints egy másik cégre a váltáshoz.'
              : 'A számaid ehhez a céghez tartoznak.'
          }
        >
          {memberships.map((m) => {
            const active = m.tenantId === current.tenantId
            return (
              <ListRow
                key={m.tenantId}
                title={m.tenantName}
                meta={TENANT_ROLE_LABELS[m.role]}
                value={active ? 'Aktív' : null}
                valueTone="muted"
                onPress={
                  active
                    ? undefined
                    : () => {
                        void Haptics.selectionAsync()
                        void selectTenant(m.tenantId)
                      }
                }
              />
            )
          })}
        </ListSection>

        <ListSection
          title="Információ"
          footer={`Turinova Admin ${APP_VERSION}`}
        >
          <ListRow
            key="adatvedelem"
            title="Adatkezelési tájékoztató"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          />
          <ListRow
            key="tamogatas"
            title="Támogatás"
            meta={SUPPORT_EMAIL}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
          <ListRow
            key="fiok-torles"
            title="Fiók törlésének kérése"
            onPress={() => setDeleteOpen(true)}
          />
        </ListSection>

        <ListSection>
          <ListRow
            key="kijelentkezes"
            title="Kijelentkezés"
            destructive
            onPress={() => setConfirmOpen(true)}
          />
        </ListSection>
      </Screen>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Fiók törlésének kérése"
        description="A fiókodat a céged adminisztrátora hozta létre. A törlési kérést emailben küldöd el, és 30 napon belül töröljük a fiókot és a hozzá tartozó személyes adatokat."
        confirmLabel="Email írása"
        onConfirm={() => {
          setDeleteOpen(false)
          const subject = encodeURIComponent('Fiók törlése — Turinova Admin')
          const body = encodeURIComponent(
            `Kérem a fiókom törlését.\n\nEmail: ${user?.email ?? ''}\nCég: ${current.tenantName}`
          )
          void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Kijelentkezel?"
        description="Legközelebb újra meg kell adnod az emailed és a jelszavad."
        confirmLabel="Kijelentkezés"
        destructive
        loading={signingOut}
        onConfirm={() => {
          setSigningOut(true)
          void signOut().finally(() => {
            setSigningOut(false)
            setConfirmOpen(false)
          })
        }}
      />
    </>
  )
}
