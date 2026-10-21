import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../lib/ui'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

function labelForValue(options: SelectOption[], value: string, placeholder: string): string {
  const match = options.find((option) => option.value === value)
  if (match) {
    return match.label
  }
  return placeholder
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  id: idProp,
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const listId = `${id}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options])
  const displayLabel = labelForValue(options, value, placeholder)
  const showPlaceholder = !options.some((option) => option.value === value)

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1)
      return
    }
    const selectedIndex = enabledOptions.findIndex((option) => option.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, value, enabledOptions])

  useEffect(() => {
    if (disabled) {
      setOpen(false)
    }
  }, [disabled])

  function selectOption(option: SelectOption) {
    if (option.disabled) {
      return
    }
    setOpen(false)
    onChange(option.value)
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (enabledOptions.length === 0) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % enabledOptions.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + enabledOptions.length) % enabledOptions.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(enabledOptions.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = enabledOptions[activeIndex]
      if (option) {
        selectOption(option)
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('ui-select relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current)
          }
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn('ui-select-trigger', open && 'ui-select-trigger-open', disabled && 'opacity-50')}
      >
        <span className={cn('min-w-0 flex-1 truncate text-left', showPlaceholder && 'text-zinc-500')}>
          {displayLabel}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200', open && 'rotate-180')}
        >
          <path
            fill="currentColor"
            d="M5.3 7.7a1 1 0 0 1 1.4 0L10 11l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={ariaLabel ? undefined : id}
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
          className="ui-select-menu ui-scrollbar absolute z-[60] mt-1.5 max-h-60 w-full overflow-y-auto p-1"
        >
          {options.map((option) => {
            const selected = option.value === value
            const enabledIndex = enabledOptions.indexOf(option)
            const active = enabledIndex === activeIndex
            return (
              <li
                key={option.value === '' ? '__empty' : option.value}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                className={cn(
                  'ui-select-option',
                  selected && 'ui-select-option-selected',
                  active && 'ui-select-option-active',
                  option.disabled && 'pointer-events-none opacity-40',
                )}
                onMouseEnter={() => {
                  if (!option.disabled && enabledIndex >= 0) {
                    setActiveIndex(enabledIndex)
                  }
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  selectOption(option)
                }}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected ? (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-300">
                    <path
                      fill="currentColor"
                      d="M7.5 10.2 4.8 7.5a1 1 0 0 0-1.4 1.4l3.5 3.5a1 1 0 0 0 1.4 0l7-7a1 1 0 1 0-1.4-1.4L8 10.2z"
                    />
                  </svg>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
