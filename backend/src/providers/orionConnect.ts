import { nonEmptyString, postJson, requireApiKey } from './http'
import { PHONE_PROVIDER_LABELS, PHONE_PROVIDER_TIMEOUT_MS } from './phoneProviderNames'
import { PhoneProvider } from './types'

const URL = 'https://api.enginy.ai/api/tmp/orionConnect'
const label = PHONE_PROVIDER_LABELS.orionConnect

// Personal mailboxes say nothing about the employer, so they cannot stand in for a company website.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
])

// Leads have no website field, so the email domain is the best available company website.
export function companyWebsiteFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.trim().toLowerCase()
  if (!domain || FREE_MAIL_DOMAINS.has(domain)) return null
  return domain
}

export const orionConnect: PhoneProvider = {
  name: 'orionConnect',
  async lookup(lead) {
    const companyWebsite = companyWebsiteFromEmail(lead.email)
    if (!companyWebsite) return null

    const response = (await postJson({
      provider: label,
      url: URL,
      headers: { 'x-auth-me': requireApiKey(label, 'ORION_CONNECT_API_KEY') },
      body: { fullName: `${lead.firstName} ${lead.lastName}`.trim(), companyWebsite },
      timeoutMs: PHONE_PROVIDER_TIMEOUT_MS.orionConnect,
    })) as { phone?: unknown }

    return nonEmptyString(response?.phone)
  },
}
