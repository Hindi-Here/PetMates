import '../project.scss'

import Add from '@icons/plus.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import CopyIcon from '@icons/copy.svg?react'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Toggle } from '../../common/toggle'
import { eventApi, type EventMediaItem, type EventMediaSection } from '../../services/event'

const MAX_TOTAL_MEDIA_SIZE = 50 * 1024 * 1024

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface EventMarkdownEditorProps {
  eventId: string
  section: EventMediaSection
  value: string
  onChange: (value: string) => void
  hasError?: boolean
  placeholder?: string
  emptyPreviewText?: string
}

// Компонент для редактирования текста с поддержкой Markdown и загрузкой медиафайлов
export const EventMarkdownEditor = ({
  eventId,
  section,
  value,
  onChange,
  hasError = false,
  placeholder,
  emptyPreviewText = 'Пока не заполнено',
}: EventMarkdownEditorProps) => {
  const [isPreview, setIsPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [media, setMedia] = useState<EventMediaItem[]>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    eventApi.getMedia(eventId, section).then(setMedia).catch(console.error)
  }, [eventId, section])

  const showMediaError = (text: string) => {
    setMediaError(text)
    setTimeout(() => setMediaError(null), 4000)
  }

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    onChange(value.slice(0, start) + text + value.slice(end))
    requestAnimationFrame(() => {
      textarea.focus()
      const pos = start + text.length
      textarea.setSelectionRange(pos, pos)
    })
  }

  const imgTag = (url: string, name: string) =>
    `\n<img src="${url}" width="400" alt="${name.replace(/["<>]/g, '')}" />\n`

  const totalSize = media.reduce((acc, m) => acc + m.size, 0)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (totalSize + file.size > MAX_TOTAL_MEDIA_SIZE) {
      showMediaError('Общий размер вложений не должен превышать 50 МБ')
      return
    }

    setIsUploading(true)
    try {
      const { url } = await eventApi.uploadMedia(eventId, section, file)
      insertAtCursor(imgTag(url, file.name))
      setMedia(await eventApi.getMedia(eventId, section))
    } catch (err) {
      showMediaError(err instanceof Error ? err.message : 'Не удалось загрузить изображение')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (item: EventMediaItem) => {
    try {
      await eventApi.deleteMedia(eventId, section, item.name)
      const escapedUrl = item.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const imgRegex = new RegExp(`<img\\s+[^>]*src=["']${escapedUrl}["'][^>]*>\\s*`, 'gi')
      onChange(value.replace(imgRegex, ''))
      setMedia(await eventApi.getMedia(eventId, section))
    } catch (err) {
      showMediaError(err instanceof Error ? err.message : 'Не удалось удалить файл')
    }
  }

  return (
    <>
      {isPreview ? (
        <div className='description-preview-container'>
          {value ? (
            <div className='project-description-preview markdown-content'>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <p className='description-preview-empty'>{emptyPreviewText}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={`project-md-editor ${hasError ? 'input-error' : ''}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}

      <div className='media-upload-section'>
        <input
          type='file'
          ref={mediaInputRef}
          accept='image/png,image/jpeg,image/webp,image/gif'
          hidden
          onChange={handleUpload}
        />
        <div className='media-upload-header'>
          <button
            type='button'
            className='media-upload-btn'
            onClick={() => mediaInputRef.current?.click()}
            disabled={isUploading || isPreview}
          >
            <Add className='media-upload-ico' />
            <span>Прикрепить медиа</span>
          </button>
          <p className='media-upload-hint'>Общий размер медиа до 50 МБ</p>

          <div className='preview-toggle-container'>
            <p className='preview-toggle-label'>Предпросмотр</p>
            <Toggle checked={isPreview} onChange={setIsPreview} />
          </div>
        </div>

        {mediaError && <p className='media-error-text'>{mediaError}</p>}

        {media.length > 0 && (
          <div className='media-list'>
            {media.map(item => (
              <div className='media-item-wrapper' key={item.name}>
                <div className='media-item'>
                  <p className='media-name'>{item.name}</p>
                  <p className='media-size'>{formatFileSize(item.size)}</p>
                </div>
                <div className='media-actions'>
                  <button
                    type='button'
                    className='media-action-btn copy'
                    onClick={() => insertAtCursor(imgTag(item.url, item.name))}
                    disabled={isPreview}
                  >
                    <CopyIcon className='ico' />
                  </button>
                  <button
                    type='button'
                    className='media-action-btn delete'
                    onClick={() => handleDelete(item)}
                    disabled={isPreview}
                  >
                    <RejectIcon className='ico' />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}