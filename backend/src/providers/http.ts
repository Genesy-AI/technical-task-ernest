import { ProviderClientError, ProviderRequestError } from './types'

interface PostJsonOptions {
  provider: string
  url: string
  body: unknown
  headers?: Record<string, string>
  timeoutMs: number
}

// POSTs JSON and classifies failures so Temporal only retries the ones that can succeed later.
export async function postJson({
  provider,
  url,
  body,
  headers,
  timeoutMs,
}: PostJsonOptions): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ProviderRequestError(`${provider} request failed: ${reason}`)
  }

  const retryable = response.status >= 500 || response.status === 408 || response.status === 429
  if (!response.ok) {
    const message = `${provider} responded with HTTP ${response.status}`
    throw retryable ? new ProviderRequestError(message) : new ProviderClientError(message)
  }

  try {
    return await response.json()
  } catch {
    throw new ProviderRequestError(`${provider} returned a response that is not valid JSON`)
  }
}

export function requireApiKey(provider: string, envName: string): string {
  const key = process.env[envName]
  if (!key) {
    throw new ProviderClientError(`${provider} is not configured: set ${envName}`)
  }
  return key
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
