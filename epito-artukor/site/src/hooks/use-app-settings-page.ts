"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { AppSettings, AppSettingsInput } from "@/types/app-settings"
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings/default-app-settings"
import {
  appSettingsInputFromSettings,
  cacheAppSettings,
  loadAppSettings,
} from "@/lib/data/app-settings-store"
import {
  fetchAppSettingsFromApi,
  saveAppSettingsToApi,
} from "@/lib/app-settings/app-settings-api-client"

export type AppSettingsFormState = AppSettingsInput

function toFormState(settings: AppSettings): AppSettingsFormState {
  return appSettingsInputFromSettings(settings)
}

export function useAppSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<AppSettingsFormState>(() => toFormState(loadAppSettings()))
  const [saving, setSaving] = useState(false)

  const applySettings = useCallback((settings: AppSettings) => {
    cacheAppSettings(settings)
    setForm(toFormState(settings))
  }, [])

  const loadFromApi = useCallback(async () => {
    const { settings, error } = await fetchAppSettingsFromApi()
    if (error) {
      toast.error(error)
      applySettings(loadAppSettings())
    } else if (settings) {
      applySettings(settings)
    }
    setLoading(false)
  }, [applySettings])

  useEffect(() => {
    void loadFromApi()
  }, [loadFromApi])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const { settings, error } = await saveAppSettingsToApi(form)
      if (error) {
        toast.error(error)
        return
      }
      if (settings) applySettings(settings)
      toast.success("Beállítások mentve")
    } catch {
      toast.error("Mentés sikertelen")
    } finally {
      setSaving(false)
    }
  }, [applySettings, form])

  const handleReset = useCallback(async () => {
    if (!confirm("Visszaállítod az alapértelmezett értékeket?")) return

    const defaults = appSettingsInputFromSettings(DEFAULT_APP_SETTINGS)

    setSaving(true)
    try {
      const { settings, error } = await saveAppSettingsToApi(defaults)
      if (error) {
        toast.error(error)
        return
      }
      if (settings) applySettings(settings)
      toast.success("Alapértelmezés visszaállítva")
    } catch {
      toast.error("Visszaállítás sikertelen")
    } finally {
      setSaving(false)
    }
  }, [applySettings])

  return {
    loading,
    form,
    setForm,
    saving,
    handleSave,
    handleReset,
  }
}
