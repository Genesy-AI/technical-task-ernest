// Pure orchestration logic, kept apart from Temporal so it can be unit tested. It runs inside the workflow
// sandbox, so it must stay deterministic: no I/O, no clocks, only the steps it is given.
import type { PhoneProviderName } from '../providers/phoneProviderNames'
import type { PhoneLookupLead } from '../providers/types'

export type PhoneEnrichmentStatus = 'IN_PROGRESS' | 'FOUND' | 'NOT_FOUND' | 'FAILED'

export interface PhoneEnrichmentProgress {
  status: PhoneEnrichmentStatus
  provider: PhoneProviderName | null
  phone?: string
}

export interface PhoneEnrichmentResult {
  status: Exclude<PhoneEnrichmentStatus, 'IN_PROGRESS'>
  phone: string | null
  provider: PhoneProviderName | null
}

export interface PhoneEnrichmentSteps {
  lookup(provider: PhoneProviderName, lead: PhoneLookupLead): Promise<string | null>
  saveProgress(update: PhoneEnrichmentProgress): Promise<void>
}

export async function runPhoneEnrichment(
  lead: PhoneLookupLead,
  providers: readonly PhoneProviderName[],
  steps: PhoneEnrichmentSteps
): Promise<PhoneEnrichmentResult> {
  let anyProviderFailed = false

  for (const provider of providers) {
    await steps.saveProgress({ status: 'IN_PROGRESS', provider })

    let phone: string | null
    try {
      phone = await steps.lookup(provider, lead)
    } catch {
      // The provider failed even after its retries. Another provider may still have the number.
      anyProviderFailed = true
      continue
    }

    if (phone) {
      await steps.saveProgress({ status: 'FOUND', provider, phone })
      return { status: 'FOUND', phone, provider }
    }
  }

  // FAILED tells the user a retry may help; NOT_FOUND means every provider answered and none had a number.
  const status = anyProviderFailed ? 'FAILED' : 'NOT_FOUND'
  await steps.saveProgress({ status, provider: null })
  return { status, phone: null, provider: null }
}
