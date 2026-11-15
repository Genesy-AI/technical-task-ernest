import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { phoneProviders } from './index'
import { ProviderClientError, ProviderRequestError, PhoneLookupLead } from './types'

const lead: PhoneLookupLead = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@analytical.co.uk',
  jobTitle: 'CTO',
  companyName: 'Analytical Engines',
}

const fetchMock = vi.fn()

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('ORION_CONNECT_API_KEY', 'orion-key')
  vi.stubEnv('ASTRA_DIALER_API_KEY', 'astra-key')
  vi.stubEnv('NIMBUS_LOOKUP_API_KEY', 'nimbus-key')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Orion Connect adapter', () => {
  it('sends full name and the company website taken from the email domain', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ phone: '+44 20 7946 0000' }))

    await expect(phoneProviders.orionConnect.lookup(lead)).resolves.toBe('+44 20 7946 0000')

    const request = lastRequest()
    expect(request.url).toBe('https://api.enginy.ai/api/tmp/orionConnect')
    expect(request.headers['x-auth-me']).toBe('orion-key')
    expect(request.body).toEqual({ fullName: 'Ada Lovelace', companyWebsite: 'analytical.co.uk' })
  })

  it('returns null when the provider has no phone', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ phone: null }))
    await expect(phoneProviders.orionConnect.lookup(lead)).resolves.toBeNull()
  })

  it('skips leads with a free-mail address without calling the provider', async () => {
    await expect(phoneProviders.orionConnect.lookup({ ...lead, email: 'ada@gmail.com' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Astra Dialer adapter', () => {
  it('sends the email with the apiKey header and reads phoneNmbr', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ phoneNmbr: '555-0100' }))

    await expect(phoneProviders.astraDialer.lookup(lead)).resolves.toBe('555-0100')

    const request = lastRequest()
    expect(request.url).toBe('https://api.enginy.ai/api/tmp/astraDialer')
    expect(request.headers.apiKey).toBe('astra-key')
    expect(request.body).toEqual({ email: 'ada@analytical.co.uk' })
  })

  it('returns null when phoneNmbr is null, missing or empty', async () => {
    for (const body of [{ phoneNmbr: null }, {}, { phoneNmbr: '  ' }]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(body))
      await expect(phoneProviders.astraDialer.lookup(lead)).resolves.toBeNull()
    }
  })
})

describe('Nimbus Lookup adapter', () => {
  it('sends email and job title with the key as the api query parameter', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ number: 600111222, countryCode: '34' }))

    await expect(phoneProviders.nimbusLookup.lookup(lead)).resolves.toBe('+34600111222')

    const request = lastRequest()
    expect(request.url).toBe('https://api.enginy.ai/api/tmp/numbusLookup?api=nimbus-key')
    expect(request.body).toEqual({ email: 'ada@analytical.co.uk', jobTitle: 'CTO' })
  })

  it('keeps a leading + in the country code and omits a missing job title', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ number: 2025550100, countryCode: '+1' }))

    await expect(phoneProviders.nimbusLookup.lookup({ ...lead, jobTitle: null })).resolves.toBe(
      '+12025550100'
    )
    expect(lastRequest().body).toEqual({ email: 'ada@analytical.co.uk' })
  })

  it('returns only the number when the country code is not numeric', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ number: 600111222, countryCode: 'ES' }))
    await expect(phoneProviders.nimbusLookup.lookup(lead)).resolves.toBe('600111222')
  })

  it('returns null when there is no number', async () => {
    for (const body of [{ number: null, countryCode: '34' }, {}, { number: 0, countryCode: '34' }]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(body))
      await expect(phoneProviders.nimbusLookup.lookup(lead)).resolves.toBeNull()
    }
  })
})

describe('provider error handling', () => {
  it('marks 5xx, 429 and network errors as retryable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503))
    await expect(phoneProviders.astraDialer.lookup(lead)).rejects.toBeInstanceOf(ProviderRequestError)

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429))
    await expect(phoneProviders.astraDialer.lookup(lead)).rejects.toBeInstanceOf(ProviderRequestError)

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(phoneProviders.astraDialer.lookup(lead)).rejects.toBeInstanceOf(ProviderRequestError)
  })

  it('marks other 4xx responses as not retryable', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    await expect(phoneProviders.astraDialer.lookup(lead)).rejects.toBeInstanceOf(ProviderClientError)
  })

  it('fails without retrying when the API key is not configured', async () => {
    vi.stubEnv('ASTRA_DIALER_API_KEY', '')
    await expect(phoneProviders.astraDialer.lookup(lead)).rejects.toThrow(
      'Astra Dialer is not configured: set ASTRA_DIALER_API_KEY'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
