import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadsList } from './LeadsList'

const { getMany, verifyEmails, enrichPhones, toastMock } = vi.hoisted(() => ({
  getMany: vi.fn(),
  verifyEmails: vi.fn(),
  enrichPhones: vi.fn(),
  toastMock: Object.assign(vi.fn(), { loading: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))

vi.mock('react-hot-toast', () => ({ default: toastMock }))

vi.mock('../api', () => ({
  api: {
    leads: {
      getMany,
      verifyEmails,
      enrichPhones,
      deleteMany: vi.fn(),
    },
  },
}))

const baseLead = {
  id: 1,
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  jobTitle: null,
  countryCode: null,
  companyName: null,
  message: null,
  emailVerified: null,
  phoneNumber: null,
  yearsAtCompany: null,
  linkedinUrl: null,
  phoneEnrichmentStatus: null,
  phoneEnrichmentProvider: null,
  createdAt: '2024-07-25T10:51:16.000Z',
  updatedAt: '2024-07-25T10:51:16.000Z',
}

// Tell React this environment supports act() so state updates flush synchronously.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const flush = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 0)))

const renderLeadsList = async (root: Root) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <LeadsList />
      </QueryClientProvider>
    )
  })
  await flush()
}

const columnValues = (container: HTMLElement, header: string) => {
  const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim())
  const index = headers.indexOf(header)
  expect(index, `column "${header}"`).toBeGreaterThan(-1)
  return Array.from(container.querySelectorAll('tbody tr')).map((row) =>
    row.children[index].textContent?.trim()
  )
}

const findButton = (label: string) =>
  Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === label)

describe('LeadsList email verification', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    getMany.mockResolvedValue([baseLead])
    await renderLeadsList(root)

    const leadCheckbox = container.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')[0]
    await act(async () => leadCheckbox.click())
    await act(async () => findButton('Enrich')!.click())
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('disables the button and shows a loading toast while verification is running', async () => {
    let resolveVerification!: (value: unknown) => void
    verifyEmails.mockReturnValue(new Promise((resolve) => (resolveVerification = resolve)))

    await act(async () => findButton('Verify Email')!.click())
    await flush()

    expect(verifyEmails).toHaveBeenCalledTimes(1)
    expect(findButton('Verifying...')).toBeDisabled()
    expect(toastMock.loading).toHaveBeenCalledWith('Verifying 1 email...', { id: 'verify-emails' })

    await act(async () => findButton('Verifying...')!.click())
    expect(verifyEmails).toHaveBeenCalledTimes(1)

    await act(async () => resolveVerification({ success: true, verifiedCount: 1, results: [], errors: [] }))
    await flush()

    expect(toastMock.success).toHaveBeenCalledWith('Verified 1 email', { id: 'verify-emails' })
  })

  it('replaces the loading toast with an error toast when verification fails', async () => {
    verifyEmails.mockRejectedValue(new Error('network'))

    await act(async () => findButton('Verify Email')!.click())
    await flush()

    expect(toastMock.error).toHaveBeenCalledWith('Failed to verify emails. Please try again.', {
      id: 'verify-emails',
    })
  })
})

describe('LeadsList new lead fields', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows phone, years at company and LinkedIn, with "-" when a value is missing', async () => {
    getMany.mockResolvedValue([
      {
        ...baseLead,
        id: 1,
        phoneNumber: '+34 600 000 000',
        yearsAtCompany: 4,
        linkedinUrl: 'https://www.linkedin.com/in/jane-smith',
      },
      { ...baseLead, id: 2, yearsAtCompany: 0 },
      { ...baseLead, id: 3, phoneNumber: undefined, yearsAtCompany: undefined, linkedinUrl: undefined },
    ])

    await renderLeadsList(root)

    expect(columnValues(container, 'Phone')).toEqual(['+34 600 000 000', '-', '-'])
    expect(columnValues(container, 'Years at Company')).toEqual(['4', '0', '-'])
    expect(columnValues(container, 'LinkedIn')).toEqual(['https://www.linkedin.com/in/jane-smith', '-', '-'])
  })
})

describe('LeadsList phone enrichment', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('shows the enrichment state in the Phone column', async () => {
    getMany.mockResolvedValue([
      { ...baseLead, id: 1, phoneEnrichmentStatus: 'IN_PROGRESS', phoneEnrichmentProvider: 'astraDialer' },
      { ...baseLead, id: 2, phoneEnrichmentStatus: 'IN_PROGRESS', phoneEnrichmentProvider: null },
      {
        ...baseLead,
        id: 3,
        phoneNumber: '+34600111222',
        phoneEnrichmentStatus: 'FOUND',
        phoneEnrichmentProvider: 'nimbusLookup',
      },
      { ...baseLead, id: 4, phoneEnrichmentStatus: 'NOT_FOUND' },
      { ...baseLead, id: 5, phoneEnrichmentStatus: 'FAILED' },
      { ...baseLead, id: 6 },
    ])

    await renderLeadsList(root)

    expect(columnValues(container, 'Phone')).toEqual([
      'Searching (Astra Dialer)...',
      'Searching...',
      '+34600111222',
      'No data found',
      'Lookup failed',
      '-',
    ])
    expect(container.querySelector('[title="Found by Nimbus Lookup"]')?.textContent).toBe('+34600111222')
  })

  it('starts enrichment for the selected leads and reports what happened', async () => {
    getMany.mockResolvedValue([
      { ...baseLead, id: 1 },
      { ...baseLead, id: 2, phoneNumber: '555-0100' },
    ])
    enrichPhones.mockResolvedValue({ started: [1], alreadyRunning: [], skipped: [2], errors: [] })
    await renderLeadsList(root)

    const selectAll = container.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!
    await act(async () => selectAll.click())
    await act(async () => findButton('Enrich')!.click())
    await act(async () => findButton('Enrich Phone')!.click())
    await flush()

    expect(enrichPhones).toHaveBeenCalledWith({ leadIds: [1, 2] })
    expect(toastMock.success).toHaveBeenCalledWith(
      'Phone search started for 1 lead. Skipped 1 that already has a phone.'
    )
  })

  it('reports an error when enrichment cannot be started', async () => {
    getMany.mockResolvedValue([{ ...baseLead, id: 1 }])
    enrichPhones.mockRejectedValue(new Error('network'))
    await renderLeadsList(root)

    await act(async () => container.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click())
    await act(async () => findButton('Enrich')!.click())
    await act(async () => findButton('Enrich Phone')!.click())
    await flush()

    expect(toastMock.error).toHaveBeenCalledWith('Failed to start phone search. Please try again.')
  })

  it('polls while a search is running, then stops and reports the outcome', async () => {
    vi.useFakeTimers()
    const advance = (ms: number) => act(async () => await vi.advanceTimersByTimeAsync(ms))

    getMany
      .mockResolvedValueOnce([
        { ...baseLead, id: 1, phoneEnrichmentStatus: 'IN_PROGRESS', phoneEnrichmentProvider: 'orionConnect' },
        { ...baseLead, id: 2, phoneEnrichmentStatus: 'IN_PROGRESS', phoneEnrichmentProvider: 'orionConnect' },
      ])
      .mockResolvedValue([
        { ...baseLead, id: 1, phoneNumber: '555-0100', phoneEnrichmentStatus: 'FOUND' },
        { ...baseLead, id: 2, phoneEnrichmentStatus: 'NOT_FOUND' },
      ])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <LeadsList />
        </QueryClientProvider>
      )
    })
    await advance(0)
    expect(getMany).toHaveBeenCalledTimes(1)

    await advance(2_100)
    expect(getMany).toHaveBeenCalledTimes(2)
    expect(columnValues(container, 'Phone')).toEqual(['555-0100', 'No data found'])
    expect(toastMock.success).toHaveBeenCalledWith('Phone search finished: 1 found, 1 with no data.')

    await advance(10_000)
    expect(getMany).toHaveBeenCalledTimes(2)
  })
})
