import { sendSimpleSms } from '@/lib/sms/simplesms'

export type PlatformSmsSendResult =
  | { ok: true; sid: string; segments: number; bodyLength: number }
  | { ok: false; error: string; segments: number; bodyLength: number }

/**
 * Platform SMS küldés — SimpleSMS (HU).
 * Korábban Twilio; a hívók ezt az egy belépési pontot használják.
 */
export async function sendPlatformSms(input: {
  toE164: string
  body: string
}): Promise<PlatformSmsSendResult> {
  return sendSimpleSms(input)
}
