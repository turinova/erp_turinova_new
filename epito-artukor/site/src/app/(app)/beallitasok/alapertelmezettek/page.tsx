import type { Metadata } from "next"
import { DefaultsSettingsClient } from "@/components/beallitasok/defaults-settings-client"

export const metadata: Metadata = {
  title: "Alapértelmezések",
}

export default function DefaultsSettingsPage() {
  return <DefaultsSettingsClient />
}
