import InfoIcon from '@icons/info_circle.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import Add from '@icons/plus.svg?react'
import './bug.scss'
import '../common/search.scss'
import { validatorFormat, useChangeInput, useIsOpen } from '../scripts/function'
import { useAuth } from '../hooks/useAuth'
import { useState, useRef } from 'react'
import { useProfile } from '../hooks/useProfile'
import { reportApi, type ReportType } from '../services/report'
import { Dropdown } from '../common/dropdown'

const MAX_TOTAL_SIZE = 50 * 1024 * 1024

// Валидация данных формы отправки сообщения
const validate = (data: any): boolean => {
  return !validatorFormat.required(data.report)
}

const reportTypeOptions: { id: ReportType; label: string }[] = [
  { id: 'bug', label: 'Баг' },
  { id: 'complaint', label: 'Жалоба' },
  { id: 'suggestion', label: 'Предложение' },
  { id: 'opinion', label: 'Мнение' },
]

// Функция для форматирования размера файла
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Страница баг-репортов и информации
export default function Bug() {
  const { isAuthenticated } = useAuth()
  const { data, handleChange } = useChangeInput({ report: '' }, {})
  const isInvalid = validate(data)

  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(!isAuthenticated)
  const { data: user } = useProfile(isAuthenticated)
  
  // Состояние для блокировки кнопки во время отправки
  const [isSending, setIsSending] = useState(false)

  const actualIsAnonymous = !isAuthenticated || isAnonymous

  // Тип обращения
  const { isOpen: isTypeDropdownOpen, setIsOpen: setIsTypeDropdownOpen, menuRef: typeMenuRef } = useIsOpen()
  const [selectedTypeId, setSelectedTypeId] = useState<ReportType>('bug')
  const selectedType = reportTypeOptions.find(o => o.id === selectedTypeId) ?? reportTypeOptions[0]

  const handleTypeSelect = (item: { id: string; label: string }) => {
    setSelectedTypeId(item.id as ReportType)
    setIsTypeDropdownOpen(false)
  }

  // Прикреплённые фото/видео
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<File[]>([])

  // Проверка размера файлов
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    
    const currentSize = attachments.reduce((acc, file) => acc + file.size, 0)
    const newSize = selected.reduce((acc, file) => acc + file.size, 0)
    
    if (currentSize + newSize > MAX_TOTAL_SIZE) {
      setSendError('Общий размер вложений не должен превышать 50 МБ')
      setTimeout(() => setSendError(null), 4000)
      e.target.value = ''
      return
    }

    setAttachments(prev => [...prev, ...selected])
    e.target.value = ''
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Отправка отчёта с обработкой успеха/ошибки
  const handleSend = async () => {
    setIsSending(true)
    setSendSuccess(false)
    setSendError(null)

    try {
      await reportApi.send(
        data.report,
        actualIsAnonymous,
        actualIsAnonymous ? undefined : user?.nickname,
        selectedTypeId,
        attachments
      )
    
      handleChange({ target: { name: 'report', value: '' } } as React.ChangeEvent<HTMLTextAreaElement>)
      setAttachments([])
      setSendSuccess(true)
      setTimeout(() => setSendSuccess(false), 3000)
    } catch (err: any) {
      setSendError(err.message || 'Ошибка отправки')
      setTimeout(() => setSendError(null), 4000)
    } finally {
      setIsSending(false)
    }
  }

  // Переключение режима анонимности
  const handleAnonymousChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsAnonymous(e.target.checked)
  }

  return (
    <div className='bug-container'>
      <div className='about-section-container'>
        <p className='about-title'>Помощь в тестировании и обратная связь</p>
        <p className='about-description'>
          PetMates — это платформа для поиска единомышленников в pet-проекты. Символично, но мы сами являемся <em>pet-проектом</em>.
        </p>
        <p className='about-description'>
          Поэтому нам очень важен ваш опыт взаимодействия с платформой и мнение. Это позволит нам расти и становиться лучше.
        </p>
        <p className='about-description'>
          Этот раздел предназначен для нашей с вами связи.
        </p>
      </div>

      <div className='about-section-container'>
        <p className='about-title'>Github репозиторий</p>
        <p className='about-description'>
          PetMates является <em>open-source</em> проектом, код которого полностью доступен любому для изучения и доработки.
        </p>
        <p className='about-description'>
          Мы приветствуем предложения по улучшению программной логики или архитектуры нашей платформы.
        </p>
        <p className='about-description'>
          Нашли баг, проблему с оптимизацией или уязвимость? Или у вас есть крутая идея? Зафиксируйте это в GitHub Issues
          нашего <span className='about-description-link'><a href='https://github.com/Hindi-Here/PetMates' target='_blank' rel='noreferrer'>репозитория</a></span>.
        </p>
      </div>

      <div className='about-section-container'>
        <p className='about-title'>Как с нами связаться</p>
        <p className='about-description'>
          Для связи с нами вы можете воспользоваться одним из нескольких способов:
        </p>
        <p className='about-description'>
          1. <strong>Форма обратной связи:</strong> Напишите нам прямо здесь. Сообщение мгновенно поступит в наш рабочий чат.
        </p>
        <p className='about-description'>
          2. <strong>Социальные сети:</strong> Мы на связи в <span className='about-description-link'><a href=''>ВК</a></span>,  
          <span className='about-description-link'><a href=''> Telegram</a></span> и 
          <span className='about-description-link'><a href=''> Одноклассники</a></span>.
          Пишите в личные сообщения сообществ и следите за новостями.
        </p>
        <p className='about-description'>
          3. <strong>Электронная почта:</strong> Наша официальная <span className='about-description-link'><a href=''>почта</a></span> для официальных запросов или объемных писем.
        </p>
      </div>

      <div className='about-section-container'>
        <p className='about-title'>Форма отправки сообщения</p>
        <p className='about-description'>
          Ниже предоставлена форма, через которую вы можете отправить нам свое мнение. Если вы нашли какой-то баг, уязвимость или неточность — смело обращайтесь к нам.
        </p>
        <p className='about-description'>
          Вы можете оставить свое сообщение <em>анонимным</em>, если вы не авторизованы. Если сообщение не является анонимным и оно нас заинтересовало — мы можем связаться с вами.
        </p>

        <div className='send-area-header-row'>
          <div className='report-type-row'>
            <p className='report-type-label'>Тип обращения:</p>
            <div className='sort-group-container'>
              <div
                ref={typeMenuRef}
                className={`sort-type-container ${isTypeDropdownOpen ? 'active' : ''}`}
                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
              >
                <p className='sort-type-text'>{selectedType.label}</p>
                <DropdownIcon className={`sort-type-dropdown-ico ${isTypeDropdownOpen ? 'rotated' : ''}`} />
              </div>
              <Dropdown isOpen={isTypeDropdownOpen} items={reportTypeOptions} onSelect={handleTypeSelect} />
            </div>
          </div>
          <p className={`char-counter ${(data.report?.length ?? 0) >= 1024 ? 'limit' : ''}`}>
            {data.report?.length ?? 0} / 1024
          </p>
        </div>

        <textarea 
          className={`send-area ${(data.report?.length ?? 0) >= 1024 ? 'input-error' : ''}`} 
          name='report' 
          value={data.report} 
          onChange={handleChange}
        ></textarea>

        <div className='attachment-section'>
          <input
            type='file'
            ref={fileInputRef}
            multiple
            accept='image/*,video/*'
            hidden
            onChange={handleFilesSelected}
            disabled={isSending}
          />
          <div className='attachment-header'>
            <button 
              type='button' 
              className='attachment-add-btn' 
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Add className='attachment-add-ico' />
              <span>Прикрепить фото/видео</span>
            </button>
            <p className='attachment-hint'>Общий размер вложений до 50 МБ</p>
          </div>

          {attachments.length > 0 && (
            <div className='attachment-list'>
              {attachments.map((file, index) => (
                <div className='attachment-item-wrapper' key={`${file.name}-${index}`}>
                  <div className='attachment-item'>
                    <p className='attachment-name'>{file.name}</p>
                    <p className='attachment-size'>{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type='button'
                    className='attachment-remove-btn reject'
                    onClick={() => handleRemoveAttachment(index)}
                    disabled={isSending}
                  >
                    <RejectIcon className='attachment-remove-ico' />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='send-manage-container'>
          <button 
            className='send-manage-button' 
            disabled={isInvalid || isSending} 
            onClick={handleSend}
          >
            Отправить
          </button>
          <input type="checkbox" className='send-anonymous-box' checked={isAnonymous} onChange={handleAnonymousChange} disabled={!isAuthenticated || isSending} />
          <p className='send-anonymous-text'>Анонимное сообщение</p>
          <div className="send-anonymous-helper-container">
            <InfoIcon className='send-anonymous-helper-ico' />
            <p className='send-anonymous-helper-text'>Оставьте активным, если хотите, чтобы ваше сообщение было анонимным</p>
          </div>
        </div>
      </div>

      {sendError && (<p className='save-error-text message-auto-hide' onAnimationEnd={() => setSendError(null)}>{sendError}</p>)}
      {sendSuccess && (<p className='save-success-text message-auto-hide' onAnimationEnd={() => setSendSuccess(false)}>Сообщение отправлено</p>)}
    </div>
  )
}