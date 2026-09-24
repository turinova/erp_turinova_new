import {
  parseSessionKickReason,
  sessionKickMessage
} from '@/lib/auth/session-cookies'

export function SessionKickBanner({ reason }: { reason?: string }) {
  const parsed = parseSessionKickReason(reason)
  if (!parsed) return null

  return (
    <p
      className="mb-3 border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-hint text-warning-ink"
      role="status"
    >
      {sessionKickMessage(parsed)}
    </p>
  )
}
