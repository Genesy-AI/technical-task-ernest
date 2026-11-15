export interface MessageField {
  key: string
  label: string
}

// Fields a message template can use. Keep in sync with `availableFields` in
// backend/src/utils/messageGenerator.ts: the backend rejects any other {field}.
export const MESSAGE_FIELDS: MessageField[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'companyName', label: 'Company' },
  { key: 'countryCode', label: 'Country code' },
  { key: 'phoneNumber', label: 'Phone number' },
  { key: 'yearsAtCompany', label: 'Years at company' },
  { key: 'linkedinUrl', label: 'LinkedIn URL' },
]

export const filterMessageFields = (fields: MessageField[], query: string) => {
  const search = query.trim().toLowerCase()
  if (!search) return fields
  return fields.filter(
    (field) => field.key.toLowerCase().includes(search) || field.label.toLowerCase().includes(search)
  )
}
