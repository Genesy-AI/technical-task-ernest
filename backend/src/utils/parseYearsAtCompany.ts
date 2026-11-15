// CSV imports send every value as text, but the column is an integer, so convert it before it reaches Prisma.
export function parseYearsAtCompany(value: unknown): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    if (/^\d+$/.test(trimmed)) return Number(trimmed)
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value

  throw new Error('yearsAtCompany must be a whole number of 0 or more')
}
