import { postJson, requireApiKey } from './http'
import { PHONE_PROVIDER_LABELS, PHONE_PROVIDER_TIMEOUT_MS } from './phoneProviderNames'
import { PhoneProvider } from './types'

const URL = 'https://api.enginy.ai/api/tmp/numbusLookup'
const label = PHONE_PROVIDER_LABELS.nimbusLookup

// Nimbus returns the number and the country code separately. The spec does not say whether the country
// code is a dialing code ("34", "+34") or an ISO code ("ES"), so only a numeric one is prefixed.
export function formatNimbusPhone(number: unknown, countryCode: unknown): string | null {
  if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) return null

  const digits = String(Math.trunc(number))
  const dialingCode = typeof countryCode === 'string' ? countryCode.trim().replace(/^\+/, '') : ''
  return /^\d{1,4}$/.test(dialingCode) ? `+${dialingCode}${digits}` : digits
}

export const nimbusLookup: PhoneProvider = {
  name: 'nimbusLookup',
  async lookup(lead) {
    const apiKey = requireApiKey(label, 'NIMBUS_LOOKUP_API_KEY')
    const response = (await postJson({
      provider: label,
      url: `${URL}?api=${encodeURIComponent(apiKey)}`,
      body: lead.jobTitle ? { email: lead.email, jobTitle: lead.jobTitle } : { email: lead.email },
      timeoutMs: PHONE_PROVIDER_TIMEOUT_MS.nimbusLookup,
    })) as { number?: unknown; countryCode?: unknown }

    return formatNimbusPhone(response?.number, response?.countryCode)
  },
}
