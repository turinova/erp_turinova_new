import * as Haptics from 'expo-haptics'
import { useCallback, useState } from 'react'

import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import { TENANT_ROLE_LABELS } from '@/lib/memberships'
import { ConfirmDialog, ListRow, ListSection, Screen } from '@/ui'

export default function TobbScreen() {
  const { user, current, memberships, selectTenant, signOut, refreshMemberships } =
    useAuth()
  const { refresh: refreshFlags } = useFlags()
  const [refreshing, setRefreshing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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
