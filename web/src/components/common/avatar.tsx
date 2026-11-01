import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e2e8f0"/><circle cx="32" cy="24" r="12" fill="#94a3b8"/><path d="M8 64c2-16 14-22 24-22s22 6 24 22z" fill="#94a3b8"/></svg>'
  )

const bustCache = (url: string) => url + (url.includes('?') ? '&' : '?') + 'r=' + Date.now()

export const Avatar = ({ 
  src, 
  alt = '', 
  className = '', 
  ...rest 
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null }) => {
  
  const safeSrc = src || undefined
  const [currentUrl, setCurrentUrl] = useState(safeSrc || DEFAULT_AVATAR)
  const hasRetried = useRef(false)

  useEffect(() => {
    hasRetried.current = false
    setCurrentUrl(src || DEFAULT_AVATAR)
  }, [src])

  const handleError = () => {
    if (currentUrl === DEFAULT_AVATAR) return
    
    if (!hasRetried.current && src) {
      hasRetried.current = true
      setTimeout(() => setCurrentUrl(bustCache(src)), 800)
      return
    }
    
    setCurrentUrl(DEFAULT_AVATAR)
  }

  return (
    <img
      {...rest}
      className={`avatar-img ${className}`.trim()}
      src={currentUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer" 
      onError={handleError}
    />
  )
}