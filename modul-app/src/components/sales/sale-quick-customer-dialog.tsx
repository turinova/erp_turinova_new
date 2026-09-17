'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createCustomer } from '@/lib/customers/actions'
import {
  formatPhoneNumber,
  HU_PHONE_EXAMPLE
} from '@/lib/customers/parse'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customer: { id: string; name: string; mobile: string | null }) => void
}

export function SaleQuickCustomerDialog({
  open,
  onOpenChange,
  onCreated
}: Props) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [mobileError, setMobileError] = useState<string | null>(null)

  function reset() {
    setName('')
    setMobile('')
    setNameError(null)
    setMobileError(null)
  }

  function handleOpenChange(next: boolean) {
    if (pending) return
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    setNameError(null)
    setMobileError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('A név megadása kötelező.')
      return
    }

    startTransition(async () => {
      const result = await createCustomer({
        name: trimmed,
        email: '',
        mobile,
        smsNotification: false,
        billingName: '',
        billingCountry: 'Magyarország',
        billingCity: '',
        billingPostalCode: '',
        billingStreet: '',
        billingHouseNumber: '',
        billingTaxNumber: '',
        billingCompanyRegNumber: ''
      })

      if (!result.ok) {
        if (result.fieldErrors?.name) setNameError(result.fieldErrors.name)
        if (result.fieldErrors?.mobile) setMobileError(result.fieldErrors.mobile)
        toast.error(result.message)
        return
      }

      toast.success('Ügyfél létrehozva.')
      onCreated({
        id: result.id,
        name: trimmed,
        mobile: mobile.trim() || null
      })
      reset()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Új ügyfél</DialogTitle>
          <DialogDescription>
            Gyors felvétel az eladáshoz. További adatokat később az Ügyfelek
            menüben szerkeszthetsz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField
            label="Név"
            htmlFor="sale-qc-name"
            required
            error={nameError ?? undefined}
          >
            <Input
              id="sale-qc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={160}
              disabled={pending}
            />
          </FormField>
          <FormField
            label="Telefon"
            htmlFor="sale-qc-mobile"
            hint={`Opcionális · pl. ${HU_PHONE_EXAMPLE}`}
            error={mobileError ?? undefined}
          >
            <Input
              id="sale-qc-mobile"
              value={mobile}
              onChange={(e) => setMobile(formatPhoneNumber(e.target.value))}
              inputMode="tel"
              disabled={pending}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            Ügyfél mentése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
