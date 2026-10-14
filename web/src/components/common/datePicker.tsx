import './datePicker.scss'
import CalendarIcon from '@icons/calendar.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'

import { useEffect, useState } from 'react'
import { useIsOpen } from '../scripts/function'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

const parseIso = (value?: string) => {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return { y, m: m - 1, d }
}

const formatIso = (value: string) => {
  const [y, m, d] = value.split('-')
  return `${d}.${m}.${y}`
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  hasError?: boolean
  disabled?: boolean
  align?: 'left' | 'right'
}

// Компонент выбора даты с календарем
export const DatePicker = ({
  value,
  onChange,
  min,
  max,
  placeholder = 'дд.мм.гггг',
  hasError = false,
  disabled = false,
  align = 'left',
}: DatePickerProps) => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen()
  const today = new Date()
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })

  useEffect(() => {
    if (!isOpen) return
    const base = parseIso(value) ?? parseIso(min) ?? { y: today.getFullYear(), m: today.getMonth(), d: 1 }
    setView({ y: base.y, m: base.m })
  }, [isOpen])

  const shiftMonth = (delta: number) =>
    setView(prev => {
      const next = new Date(prev.y, prev.m + delta, 1)
      return { y: next.getFullYear(), m: next.getMonth() }
    })

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7
  const isDisabledDay = (iso: string) => (!!min && iso < min) || (!!max && iso > max)

  return (
    <div className='date-picker' ref={menuRef}>
      <button
        type='button'
        className={`date-picker-field ${hasError ? 'input-error' : ''} ${isOpen ? 'active' : ''}`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? '' : 'placeholder'}>{value ? formatIso(value) : placeholder}</span>
        <CalendarIcon className='date-picker-ico' />
      </button>

      {isOpen && (
        <div className={`date-picker-popup ${align}`}>
          <div className='date-picker-head'>
            <button type='button' className='date-picker-nav' onClick={() => shiftMonth(-1)}>
              <DropdownIcon className='date-picker-nav-ico prev' />
            </button>
            <p className='date-picker-title'>{MONTHS[view.m]} {view.y}</p>
            <button type='button' className='date-picker-nav' onClick={() => shiftMonth(1)}>
              <DropdownIcon className='date-picker-nav-ico next' />
            </button>
          </div>

          <div className='date-picker-weekdays'>
            {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
          </div>

          <div className='date-picker-grid'>
            {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const iso = toIso(view.y, view.m, day)
              return (
                <button
                  key={iso}
                  type='button'
                  className={`date-picker-day ${iso === value ? 'selected' : ''} ${iso === todayIso ? 'today' : ''}`}
                  disabled={isDisabledDay(iso)}
                  onClick={() => { onChange(iso); setIsOpen(false) }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className='date-picker-footer'>
            <button
              type='button'
              className='date-picker-clear'
              disabled={!value}
              onClick={() => { onChange(''); setIsOpen(false) }}
            >
              Очистить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}