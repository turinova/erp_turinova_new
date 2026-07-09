import type { Client } from "@/types/clients"

export const CLIENT_TYPE_LABELS: Record<Client["clientType"], string> = {
  company: "Cég",
  individual: "Magán személy",
}

export const CLIENT_STATUS_LABELS: Record<Client["status"], string> = {
  active: "Aktív",
  inactive: "Inaktív",
  prospect: "Lehetőség",
}
