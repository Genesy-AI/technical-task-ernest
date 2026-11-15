import type { PhoneProviderName } from './phoneProviderNames'

// The lead data any provider may need. Each adapter picks the fields its API asks for.
export interface PhoneLookupLead {
  id: number
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  companyName: string | null
}

export interface PhoneProvider {
  name: PhoneProviderName
  // Returns the phone number, or null when the provider has none (or cannot search this lead).
  lookup(lead: PhoneLookupLead): Promise<string | null>
}

// Retrying will not help (bad credentials, invalid request). The workflow's retry policy lists this name
// in nonRetryableErrorTypes, so Temporal moves on to the next provider straight away.
export class ProviderClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderClientError'
  }
}

// Temporary failure (timeout, 5xx, rate limit). Temporal retries it with backoff.
export class ProviderRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRequestError'
  }
}
