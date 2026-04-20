import './profile.scss'

import DefaultAvatarIcon from '@icons/default_avatar.svg?react'
import LockIcon from '@icons/lock.svg?react'
import React from 'react';

const UnauthorizedProfile = () => {
  const guestName = React.useMemo(() => {
    const savedName = sessionStorage.getItem('guest_name');
   
    if (savedName) {
      return savedName;
    }

    const newName = 'Guest_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('guest_name', newName);
    
    return newName;
  }, []);

  return (
    <div className='profile-info-container'>
        <div className='main-info-container'>
            <div className='avatar-container'>
                <DefaultAvatarIcon className='avatar-ico'/>
            </div>
            <div className='user-info-container'>
                <p className='user-info-name'> { guestName }</p>
                <p className='user-info-role'> Анонимный пользователь </p>
                <div className='online-container'>
                    <div className='online-circle'/>
                    <div className='online-text'> онлайн </div>
                </div>
            </div>
        </div>
        <div className='separator'></div>
        <div className='secondary-info-container'>
            <LockIcon className='info-ico'/>
            <p className='info-comment'> Зарегистрируйтесь или войдите в аккаунт, чтобы управлять профилем и взаимодействовать с контентом.</p>
            <button className='info-login-button'> Войти </button>
            <button className='info-login-button cancellation'> Регистрация </button>
        </div>
    </div>
  )
}

const AuthorizedProfile = () => {
  return (
    <div className='main-info-container'>
    </div>
  )
}
export default function Profile () {

  return (
    <UnauthorizedProfile></UnauthorizedProfile>
  )
}