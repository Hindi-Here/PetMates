import './ban.scss'
import LockIcon from '@icons/lock.svg?react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/cfg'

interface BannedPageProps {
  reason?: string
}

export default function BannedPage({ reason }: BannedPageProps) {
  const navigate = useNavigate()

  const handleReturn = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('userBanned')
    navigate('/vacancy', { replace: true })
  }

  return (
    <div className='banned-page'>
      <LockIcon className='banned-icon' />
      <h1 className='banned-title'>Аккаунт заблокирован</h1>
      <p className='banned-message'>Ваш аккаунт был заблокирован администрацией.</p>
      
      {reason && (
        <p className='banned-reason'>
          <span className='banned-reason-label'>Причина:</span> {reason}
        </p>
      )}
      
      <p className='banned-message'>Если вы считаете, что это ошибка, свяжитесь с поддержкой.</p>
      
      <button className='return-button' onClick={handleReturn}>
        Вернуться
      </button>
    </div>
  )
}