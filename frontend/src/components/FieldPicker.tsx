import { FC, KeyboardEvent, useId, useState } from 'react'
import { filterMessageFields, MessageField } from './messageFields'

interface FieldPickerProps {
  fields: MessageField[]
  onSelect: (key: string) => void
}

// Searchable list of template fields, so the picker stays usable as the field list grows.
export const FieldPicker: FC<FieldPickerProps> = ({ fields, onSelect }) => {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()

  const matches = filterMessageFields(fields, query)
  const active = Math.min(activeIndex, Math.max(matches.length - 1, 0))

  const select = (key: string) => {
    onSelect(key)
    setQuery('')
    setActiveIndex(0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (matches.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((active + step + matches.length) % matches.length)
    } else if (event.key === 'Enter') {
      // Enter inserts a field; it must not submit the surrounding form.
      event.preventDefault()
      if (matches[active]) select(matches[active].key)
    } else if (event.key === 'Escape' && query) {
      // First Escape clears the search; the next one closes the modal as before.
      event.stopPropagation()
      setQuery('')
      setActiveIndex(0)
    }
  }

  return (
    <div className="border border-gray-200 rounded-md">
      <input
        type="search"
        aria-label="Search fields"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={matches[active] ? `${listId}-${matches[active].key}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search fields to insert..."
        className="w-full px-3 py-2 text-sm border-b border-gray-200 rounded-t-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <ul id={listId} role="listbox" aria-label="Fields" className="max-h-36 overflow-y-auto p-1">
        {matches.map((field, index) => (
          <li
            key={field.key}
            id={`${listId}-${field.key}`}
            role="option"
            aria-selected={index === active}
            // Keep focus in the search box or textarea so the cursor position is not lost.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select(field.key)}
            onMouseEnter={() => setActiveIndex(index)}
            className={`flex items-center justify-between px-2 py-1 text-sm rounded cursor-pointer ${
              index === active ? 'bg-blue-100 text-blue-900' : 'text-gray-700'
            }`}
          >
            <span>{field.label}</span>
            <code className="text-xs text-blue-800">{`{${field.key}}`}</code>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-2 py-1 text-sm text-gray-500">No fields match "{query.trim()}"</li>
        )}
      </ul>
    </div>
  )
}
