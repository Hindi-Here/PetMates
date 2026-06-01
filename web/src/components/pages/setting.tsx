import './setting.scss'
import { Toggle } from '../common/toggle'
import { useEffect, useState } from 'react'

import ImportantIcon from '@icons/important_warning.svg?react'
import DeleteIcon from '@icons/delete.svg?react'

export const Setting = () => {

    // dark theme control
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme')
            if (saved) return saved === 'dark'
            return window.matchMedia('(prefers-color-scheme: dark)').matches
        }
        return false
    })

    useEffect(() => {
        const root = document.documentElement
  
        if (isDarkTheme) {
            root.setAttribute('data-theme', 'dark')
             localStorage.setItem('theme', 'dark')
        }
        else {
            root.setAttribute('data-theme', 'light')
            localStorage.setItem('theme', 'light')
        }
    }, [isDarkTheme])

  return (
    <>
        <div className="section-container">
            <p className="section-title"> Общие параметры </p>
            <div className='setting-container'>
                <p className="setting-title"> Цветовая схема </p>
                <div className="setting-field-container">
                    <p className="field-name"> Темная тема: </p>
                    <Toggle checked={isDarkTheme} onChange={setIsDarkTheme}/>
                </div>
            </div>
        </div>

        <div className="section-container">
            <p className="section-title"> Безопасность </p>
            <div className="setting-container">
                <p className="setting-title"> Смена пароля </p>
                <div className="setting-field-container">
                    <p className="field-name"> Старый пароль: </p>
                    <input className="field-input"/>
                </div>
                 <div className="setting-field-container">
                    <p className="field-name"> Новый пароль: </p>
                    <input className="field-input"/>
                </div>
                 <div className="setting-field-container">
                    <p className="field-name"> Подтвержденеи пароля: </p>
                    <input className="field-input"/>
                </div>
            </div>

            <div className="setting-container">
                <p className="setting-title"> Смена почты </p>
                <div className="setting-field-container">
                    <p className="field-name"> Текущая почта: </p>
                    <input className="field-input"/>
                </div>
                 <div className="setting-field-container">
                    <p className="field-name"> Новая почта: </p>
                    <input className="field-input"/>
                </div>
                 <div className="setting-field-container">
                    <p className="field-name"> Код подтверждения: </p>
                    <input className="field-input"/>
                </div>
            </div>
        </div>

        <div className="section-container">
            <p className="section-title"> Аккаунт </p>
            <div className='warning-container'>
                <div className='warning-tittle-container'>
                    <ImportantIcon className='svg-ico'></ImportantIcon>
                    <p className='warning-tittle'> Удаление аккаунта </p>
                </div>
                <p className='warning-description'> Это действие необратимо. Ваш аккаунт будет удалён навсегда со всеми данными. </p>
                <button className='warning-button'>
                    <DeleteIcon className='svg-ico'></DeleteIcon>
                    Удалить аккаунт
                </button>
            </div>
        </div>

        <div className='manage-container'>
            <button className='manage-button'>
                Сохранить
            </button>
            <button className='manage-button cancellation'>
                Отмена
            </button>
        </div>
    </>
  )
}