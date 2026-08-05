import './setting.scss'
import { Toggle } from '../common/toggle'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useChangeInput, validatorFormat, validatorRegex } from '../scripts/function'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { settingApi } from '../services/setting'
import DeleteAccountForm from '../forms/delete_account'

import ImportantIcon from '@icons/important_warning.svg?react'
import DeleteIcon from '@icons/delete.svg?react'

// Валидация поля пароля и возврат сообщения об ошибке
const checkPasswordFormat = (fieldName: string, value: string, newPassword: string): string | null => {
  const rules: Record<string, Array<[boolean, string]>> = {
    oldPassword: [
      [!validatorFormat.required(value), 'Введите старый пароль'],
      [!validatorFormat.minLength(value, 8), 'Минимум 8 символов'],
    ],
    newPassword: [
      [!validatorFormat.required(value), 'Введите новый пароль'],
      [!validatorFormat.minLength(value, 8), 'Минимум 8 символов'],
      [!validatorFormat.maxLength(value, 255), 'Слишком длинный пароль'],
      [!validatorFormat.password(value), 'Пароль должен содержать буквы, цифры и спец. символы'],
    ],
    confirmPassword: [
      [!validatorFormat.required(value), 'Подтвердите пароль'],
      [value !== newPassword, 'Пароли не совпадают'],
    ],
  }
  const fieldRules = rules[fieldName]
  if (!fieldRules) return null
  const error = fieldRules.find(([isInvalid]) => isInvalid)
  return error?.[1] ?? null
}

// Валидация поля email и возврат сообщения об ошибке
const checkEmailFormat = (fieldName: string, value: string): string | null => {
  const rules: Record<string, Array<[boolean, string]>> = {
    newEmail: [
      [!validatorFormat.email(value), 'Некорректный формат email'],
      [!validatorFormat.maxLength(value, 255), 'Максимум 255 символов'],
    ],
    confirmCode: [
      [!validatorFormat.required(value), 'Введите код подтверждения'],
    ],
  }
  const fieldRules = rules[fieldName]
  if (!fieldRules) return null
  const error = fieldRules.find(([isInvalid]) => isInvalid)
  return error?.[1] ?? null
}

// Рендер поля ввода пароля с валидацией
const renderPasswordField = (
  label: string,
  name: 'oldPassword' | 'newPassword' | 'confirmPassword',
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void,
  touched: Record<string, boolean>,
  dirty: Record<string, boolean>,
  newPassword: string
) => (
  <div className="setting-field-container">
    <p className="field-name">{label}</p>
    <input
      className={`field-input ${touched[name] && dirty[name] && checkPasswordFormat(name, value, newPassword) ? 'input-error' : ''}`}
      type="password"
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
    />
  </div>
)

// Рендер поля ввода email с валидацией
const renderEmailField = (
  label: string,
  name: 'newEmail' | 'confirmCode',
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void,
  touched: Record<string, boolean>,
  dirty: Record<string, boolean>
) => (
  <div className="setting-field-container">
    <p className="field-name">{label}</p>
    <input
      className={`field-input ${touched[name] && dirty[name] && checkEmailFormat(name, value) ? 'input-error' : ''}`}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
    />
  </div>
)

export const Setting = () => {
  const { isAuthenticated } = useAuth()
  const { data: user } = useProfile(isAuthenticated)

  // Инициализация темы из localStorage или системных настроек
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  // Применение темы к documentElement и сохранение в localStorage
  useEffect(() => {
    const root = document.documentElement
    if (isDarkTheme) {
      root.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.setAttribute('data-theme', 'light')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkTheme])

  // Хук для управления полями смены пароля
  const { data: passData, touched: passTouched, dirty: passDirty, handleChange: handlePassChange, handleBlur: handlePassBlur } = useChangeInput(
    { oldPassword: '', newPassword: '', confirmPassword: '' },
    {
      oldPassword: validatorRegex.password,
      newPassword: validatorRegex.password,
      confirmPassword: validatorRegex.password,
    }
  )

  // Хук для управления полями смены email
  const { data: emailData, touched: emailTouched, dirty: emailDirty, handleChange: handleEmailChange, handleBlur: handleEmailBlur } = useChangeInput(
    { newEmail: '', confirmCode: '' },
    { newEmail: validatorRegex.email }
  )

  // Проверка валидности всех полей пароля
  const isPasswordValid = useMemo(() => {
    return (
      validatorFormat.required(passData.oldPassword) &&
      validatorFormat.minLength(passData.oldPassword, 8) &&
      validatorFormat.required(passData.newPassword) &&
      validatorFormat.minLength(passData.newPassword, 8) &&
      validatorFormat.password(passData.newPassword) &&
      validatorFormat.required(passData.confirmPassword) &&
      passData.newPassword === passData.confirmPassword
    )
  }, [passData])

  // Проверка валидности всех полей email
  const isEmailValid = useMemo(() => {
    return (
      validatorFormat.required(emailData.newEmail) &&
      validatorFormat.email(emailData.newEmail) &&
      validatorFormat.required(emailData.confirmCode)
    )
  }, [emailData])

  const [passError, setPassError] = useState<string | null>(null)
  const [passSuccess, setPassSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  // Смена email с обработкой успеха/ошибки
  const handleChangeEmail = useCallback(async () => {
    setEmailError(null)
    setEmailSuccess(false)
    try {
      await settingApi.changeEmail(emailData.newEmail, emailData.confirmCode)
      setEmailSuccess(true)
      setTimeout(() => setEmailSuccess(false), 3000)
    } catch (err: any) {
      setEmailError(err.message || 'Ошибка смены почты')
      setTimeout(() => setEmailError(null), 3000)
    }
  }, [emailData])

  // Смена пароля с обработкой успеха/ошибки
  const handleChangePassword = useCallback(async () => {
    setPassError(null)
    setPassSuccess(false)
    try {
      await settingApi.changePassword(passData.oldPassword, passData.newPassword, passData.confirmPassword)
      setPassSuccess(true)
      setTimeout(() => setPassSuccess(false), 3000)
    } catch (err: any) {
      setPassError(err.message || 'Ошибка смены пароля')
      setTimeout(() => setPassError(null), 3000)
    }
  }, [passData])

  return (
    <>
      <div className="section-container">
        <p className="section-title">Общие параметры</p>
        <div className='setting-container'>
          <p className="setting-title">Цветовая схема</p>
          <div className="setting-field-container">
            <p className="field-name">Темная тема:</p>
            <Toggle checked={isDarkTheme} onChange={setIsDarkTheme} />
          </div>
        </div>
      </div>

      <div className="section-container">
        <p className="section-title">Безопасность</p>

        <div className="setting-container">
          <p className="setting-title">Смена пароля</p>
          {renderPasswordField('Старый пароль:', 'oldPassword', passData.oldPassword, handlePassChange, handlePassBlur, passTouched, passDirty, passData.newPassword)}
          {renderPasswordField('Новый пароль:', 'newPassword', passData.newPassword, handlePassChange, handlePassBlur, passTouched, passDirty, passData.newPassword)}
          {renderPasswordField('Подтверждение пароля:', 'confirmPassword', passData.confirmPassword, handlePassChange, handlePassBlur, passTouched, passDirty, passData.newPassword)}
          <div className='manage-container'>
            <button className='manage-button' disabled={!isPasswordValid} onClick={handleChangePassword}>
              Сменить пароль
            </button>
          </div>
        </div>
        {passError && <p className='save-error-text message-auto-hide'>{passError}</p>}
        {passSuccess && <p className='save-success-text message-auto-hide'>Пароль успешно изменён</p>}

        <div className="setting-container">
          <p className="setting-title">Смена почты</p>
          <div className="setting-field-container">
            <p className="field-name">Текущая почта:</p>
            <input className="field-input readonly" value={user?.email ?? ''} readOnly />
          </div>
          {renderEmailField('Новая почта:', 'newEmail', emailData.newEmail, handleEmailChange, handleEmailBlur, emailTouched, emailDirty)}
          {renderEmailField('Код подтверждения:', 'confirmCode', emailData.confirmCode, handleEmailChange, handleEmailBlur, emailTouched, emailDirty)}
          <div className='manage-container'>
            <button className='manage-button' disabled={!isEmailValid} onClick={handleChangeEmail}>
              Сменить почту
            </button>
          </div>
        </div>
        {emailError && <p className='save-error-text message-auto-hide'>{emailError}</p>}
        {emailSuccess && <p className='save-success-text message-auto-hide'>Почта успешно изменена</p>}
      </div>

      <div className="section-container">
        <p className="section-title">Аккаунт</p>
        <div className='warning-container'>
          <div className='warning-tittle-container'>
            <ImportantIcon className='svg-ico' />
            <p className='warning-tittle'>Удаление аккаунта</p>
          </div>
          <p className='warning-description'>Это действие необратимо. Ваш аккаунт будет удалён навсегда со всеми данными.</p>
          <button className='warning-button' onClick={() => setShowDeleteForm(true)}>
            <DeleteIcon className='svg-ico' />
            Удалить аккаунт
          </button>
          {showDeleteForm && <DeleteAccountForm onClose={() => setShowDeleteForm(false)} />}
        </div>
      </div>
    </>
  )
}