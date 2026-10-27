import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import { useBlockScroll } from '../scripts/function'
import { moderationApi } from '../services/moderation'
import { useState } from 'react'
import { LIMITS } from '../scripts/limits'

interface BanUserFormProps {
  userId: string
  nickname: string
  onClose: () => void
  onSuccess?: () => void
}

// Компонент формы блокировки пользователя (модерация)
const Form = ({ userId, nickname, onClose, onSuccess }: BanUserFormProps) => {
  const [reason, setReason] = useState('')
  const [isBanning, setIsBanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBan = async () => {
    if (!reason.trim() || isBanning) return
    try {
      setIsBanning(true)
      await moderationApi.banUser(userId, reason.trim())
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие')
    } finally {
      setIsBanning(false)
    }
  }

  return (
    <div className='form-container'>
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico' />
        <p className='form-header-text'>Блокировка пользователя</p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-info-container'>
          <p className='form-info-text'>
            <span className='form-info-text-title'>
              Заблокировать пользователя @{nickname}?
            </span>
            <br /><br />
            <span className='form-info-text-description'>
              Аккаунт не будет удалён из системы — данные сохранятся, но доступ к платформе будет ограничен.
            </span>
          </p>
        </div>

        <div className='form-field-container'>
          <div className='profile-area-text-container'>
            <div className='profile-area-text-wrapper'>
              <p className='profile-area-text'>Причина блокировки<sup className='required-mark'>*</sup></p>
              <p className={`char-counter ${reason.length >= LIMITS.moderation.reasonMax ? 'limit' : ''}`}>
                {reason.length} / {LIMITS.moderation.reasonMax}
              </p>
            </div>
          </div>
          <textarea
            className='form-field-input message red'
            value={reason}
            maxLength={LIMITS.moderation.reasonMax}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Опишите причину — она будет показана пользователю'
            rows={3}
          />
        </div>

        {error && <p className='invite-error-text'>{error}</p>}
        <div className='form-manage'>
          <button
            className='form-manage-button red'
            onClick={handleBan}
            disabled={isBanning || !reason.trim()}
          >
            Заблокировать
          </button>
          <button
            className='form-manage-button cancellation'
            onClick={onClose}
            disabled={isBanning}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BanUserForm({ userId, nickname, onClose, onSuccess }: BanUserFormProps) {
  useBlockScroll(true)
  return (
    <div className='dark-area-container' onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Form userId={userId} nickname={nickname} onClose={onClose} onSuccess={onSuccess} />
      </div>
    </div>
  )
}