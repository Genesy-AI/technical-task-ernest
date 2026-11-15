import { describe, expect, it, vi } from 'vitest'
import { PHONE_PROVIDER_ORDER, PhoneProviderName } from '../providers/phoneProviderNames'
import type { PhoneLookupLead } from '../providers/types'
import { PhoneEnrichmentProgress, runPhoneEnrichment } from './phoneEnrichment'

const lead = {
  id: 7,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@analytical.co.uk',
  jobTitle: 'CTO',
  companyName: null,
}

type Answer = string | null | Error

const setup = (answers: Partial<Record<PhoneProviderName, Answer>>) => {
  const progress: PhoneEnrichmentProgress[] = []
  const lookup = vi.fn(async (provider: PhoneProviderName, _lead: PhoneLookupLead) => {
    const answer = answers[provider] ?? null
    if (answer instanceof Error) throw answer
    return answer
  })
  const saveProgress = vi.fn(async (update: PhoneEnrichmentProgress) => {
    progress.push(update)
  })
  return { lookup, saveProgress, progress, steps: { lookup, saveProgress } }
}

describe('runPhoneEnrichment', () => {
  it('stops at the first provider that finds a phone', async () => {
    const { steps, lookup, progress } = setup({ orionConnect: '+44 20 7946 0000' })

    const result = await runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, steps)

    expect(result).toEqual({ status: 'FOUND', phone: '+44 20 7946 0000', provider: 'orionConnect' })
    expect(lookup.mock.calls.map(([provider]) => provider)).toEqual(['orionConnect'])
    expect(progress).toEqual([
      { status: 'IN_PROGRESS', provider: 'orionConnect' },
      { status: 'FOUND', provider: 'orionConnect', phone: '+44 20 7946 0000' },
    ])
  })

  it('asks the providers in order until one finds a phone', async () => {
    const { steps, lookup, progress } = setup({ nimbusLookup: '+34600111222' })

    const result = await runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, steps)

    expect(result).toEqual({ status: 'FOUND', phone: '+34600111222', provider: 'nimbusLookup' })
    expect(lookup.mock.calls.map(([provider]) => provider)).toEqual([
      'orionConnect',
      'astraDialer',
      'nimbusLookup',
    ])
    expect(progress.map((update) => update.provider)).toEqual([
      'orionConnect',
      'astraDialer',
      'nimbusLookup',
      'nimbusLookup',
    ])
  })

  it('passes the lead to every provider', async () => {
    const { steps, lookup } = setup({})
    await runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, steps)
    expect(lookup.mock.calls.every(([, passedLead]) => passedLead === lead)).toBe(true)
  })

  it('marks the lead as NOT_FOUND when no provider has a phone', async () => {
    const { steps, progress } = setup({})

    const result = await runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, steps)

    expect(result).toEqual({ status: 'NOT_FOUND', phone: null, provider: null })
    expect(progress.at(-1)).toEqual({ status: 'NOT_FOUND', provider: null })
  })

  it('moves on to the next provider when one fails after its retries', async () => {
    const { steps, lookup } = setup({
      orionConnect: new Error('Orion Connect responded with HTTP 503'),
      astraDialer: '555-0100',
    })

    const result = await runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, steps)

    expect(result).toEqual({ status: 'FOUND', phone: '555-0100', provider: 'astraDialer' })
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('marks the lead as FAILED when a provider failed and none found a phone', async () => {
    const { steps, progress } = setup({ astraDialer: new Error('Astra Dialer responded with HTTP 503') })

    const result = await runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, steps)

    expect(result).toEqual({ status: 'FAILED', phone: null, provider: null })
    expect(progress.at(-1)).toEqual({ status: 'FAILED', provider: null })
  })
})
