import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageTemplateModal } from './MessageTemplateModal'

const { generateMessages } = vi.hoisted(() => ({ generateMessages: vi.fn() }))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../api', () => ({ api: { leads: { generateMessages } } }))

// Tell React this environment supports act() so state updates flush synchronously.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ALL_FIELDS = [
  '{firstName}',
  '{lastName}',
  '{email}',
  '{jobTitle}',
  '{companyName}',
  '{countryCode}',
  '{phoneNumber}',
  '{yearsAtCompany}',
  '{linkedinUrl}',
]

// React tracks controlled values itself, so set the value through the native setter and fire an input event.
const typeInto = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

const pressKey = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const searchInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Search fields"]')!
const textarea = () => document.querySelector<HTMLTextAreaElement>('#message-template')!
const fieldOptions = () =>
  Array.from(document.querySelectorAll('[role="option"]')).map(
    (option) => option.querySelector('code')?.textContent
  )

describe('MessageTemplateModal field picker', () => {
  let container: HTMLDivElement
  let root: Root
  const onClose = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <MessageTemplateModal isOpen onClose={onClose} selectedLeadIds={[1]} selectedLeadsCount={1} />
        </QueryClientProvider>
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('lists every lead field, including phone number, years at company and LinkedIn URL', () => {
    expect(fieldOptions()).toEqual(ALL_FIELDS)
  })

  it('filters fields by name or label, ignoring case', async () => {
    await act(async () => typeInto(searchInput(), 'LINKED'))
    expect(fieldOptions()).toEqual(['{linkedinUrl}'])

    await act(async () => typeInto(searchInput(), 'years at'))
    expect(fieldOptions()).toEqual(['{yearsAtCompany}'])

    await act(async () => typeInto(searchInput(), 'phone'))
    expect(fieldOptions()).toEqual(['{phoneNumber}'])
  })

  it('shows a message when no field matches', async () => {
    await act(async () => typeInto(searchInput(), 'zzz'))
    expect(fieldOptions()).toEqual([])
    expect(document.body.textContent).toContain('No fields match "zzz"')
  })

  it('inserts the clicked field at the cursor position', async () => {
    await act(async () => typeInto(textarea(), 'Hi !'))
    textarea().setSelectionRange(3, 3)

    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (element) => element.querySelector('code')?.textContent === '{firstName}'
    )!
    await act(async () => option.click())

    expect(textarea().value).toBe('Hi {firstName}!')
  })

  it('inserts the highlighted match on Enter without submitting the form, then clears the search', async () => {
    await act(async () => typeInto(searchInput(), 'year'))
    await act(async () => pressKey(searchInput(), 'Enter'))

    expect(textarea().value).toBe('{yearsAtCompany}')
    expect(generateMessages).not.toHaveBeenCalled()
    expect(searchInput().value).toBe('')
  })

  it('moves the highlight with the arrow keys', async () => {
    await act(async () => typeInto(searchInput(), 'name'))
    expect(fieldOptions()).toEqual(['{firstName}', '{lastName}', '{companyName}'])

    await act(async () => pressKey(searchInput(), 'ArrowDown'))
    await act(async () => pressKey(searchInput(), 'Enter'))

    expect(textarea().value).toBe('{lastName}')
  })

  it('clears the search on Escape instead of closing the modal', async () => {
    await act(async () => typeInto(searchInput(), 'email'))
    await act(async () => pressKey(searchInput(), 'Escape'))

    expect(searchInput().value).toBe('')
    expect(onClose).not.toHaveBeenCalled()
  })
})
