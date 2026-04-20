import './authorization.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'
import RegisterIcon from '@icons/register.svg?react'
import SignIcon from '@icons/sign.svg?react'

import GoogleColorIcon from '@icons/google_color.svg?react'
import GithubColorIcon from '@icons/github_color.svg?react'
import TelegramColorIcon from '@icons/telegram_color.svg?react'

import { useState, useEffect } from 'react'
import { useBlockScroll, ValidatorCfg, useChangeInput, ValidatorRegexCleanerCfg } from '../scripts/function'

const Form = ({ onClose }: any) => {
  // switching between registration and login state
  const [isRegister, setIsRegister] = useState(true);

  // launch change input event
  const { data, handleChange, resetForm } = useChangeInput({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      rememberMe: false
    },
    {
      /* rules input */
      name: ValidatorRegexCleanerCfg.username,
      email: ValidatorRegexCleanerCfg.email, 
      password: ValidatorRegexCleanerCfg.password, 
      confirmPassword: ValidatorRegexCleanerCfg.password,
    }
  );

  // reset content when switch reg/log mode
  useEffect(() => { resetForm(); }, [isRegister]);

  // check on disabled for button
  const isInvalid = validate(data, isRegister);

  return (
    <div className='form-container'> 

        <div className='form-header-container'>
            {isRegister ? <RegisterIcon className='form-header-ico'/> : <SignIcon className='form-header-ico'/>}
            <p className='form-header-text'> 
            {isRegister ? 'Регистрация аккаунта' : 'Вход в аккаунт'} 
            </p>
            <button className='form-header-close-button' onClick={onClose}>
                <RejectIcon className='form-header-close-ico' />
            </button>
        </div>

        <div className='form-content-container'>
            <div className='form-field-container'>
                <p className='form-field-text'> Имя пользователя </p>
                <input className='form-field-input' name='name' maxLength={50} value={data.name} onChange={handleChange}/>
                {isRegister && (
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Имя пользователя может быть от 3 до 50 символов </p>
                </div>
                )}
            </div>
            {isRegister && (
            <div className='form-field-container'>
                <p className='form-field-text'> Email </p>
                <input className='form-field-input' name='email' maxLength={255} value={data.email} onChange={handleChange}/>
            </div>
            )}
            <div className='form-field-container'>
                <p className='form-field-text'> Пароль </p>
                <input className='form-field-input' name='password' maxLength={255} value={data.password} onChange={handleChange}/>
                {isRegister && (
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Пароль должен содержать не менее 8 символов, включая цифры, буквы, спец. символы </p>
                </div>
                )}
                {!isRegister && (
                <div className="form-field-forgot-password-container">
                    <p className='form-field-forgot-password-text'>Забыли пароль?</p>
                </div>
                )}
            </div>
            {isRegister && (
            <div className='form-field-container'>
                <p className='form-field-text'> Подтверждение пароля </p>
                <input className='form-field-input' type='password' name='confirmPassword' maxLength={255} value={data.confirmPassword} onChange={handleChange}/>
            </div>
            )}
            <div className='form-remember-me-container'>
                <input type="checkbox" className='form-remember-me-checkbox' name='rememberMe' checked={data.rememberMe} onChange={handleChange}/>
                <p className='form-remember-me-text'>Запомнить меня на этом устройстве </p>
            </div>
            <div className='form-complete-container'>
                <button className='form-complete-button' disabled={isInvalid}>
                    {isRegister ? <RegisterIcon className='form-header-ico' /> : <SignIcon className='form-header-ico' />}
                    {isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>
            </div>
        </div>

        <div className='auth-service-container'>
            <div className='auth-service-separator-container'>
                <p className='auth-service-separator-text'> или </p>
            </div>
            <div className='auth-service-items-container'>
                <div className='auth-service-item-container'>
                    <GoogleColorIcon className='auth-service-item-ico'/>
                    <p className='auth-service-item-text'> Google </p>
                </div>
                <div className='auth-service-item-container'>
                    <GithubColorIcon className='auth-service-item-ico git'/>
                    <p className='auth-service-item-text'> Github </p>
                </div>
                <div className='auth-service-item-container'>
                    <TelegramColorIcon className='auth-service-item-ico'/>
                    <p className='auth-service-item-text'> Telegram </p>
                </div>
            </div>
        </div>

        <div className='auth-change-format-container'>
            <p className='auth-change-format-text'> 
            {isRegister ? 'Уже есть аккаунт?' : 'Еще нет аккаунта?'} 
            </p>
            <p className='auth-change-format-link' onClick={() => setIsRegister(!isRegister)}> 
            {isRegister ? 'Войти' : 'Зарегистрироваться'} 
            </p>
        </div>

    </div>
  )
}

// validate rule for form
const validate = (data: any, isRegister: boolean): boolean => {
  const isInvalid = 
    !ValidatorCfg.required(data.name) ||
    !ValidatorCfg.minLength(data.name, 3) ||

    !ValidatorCfg.required(data.password)

  if (isRegister) {
    return (
      isInvalid || 
      !ValidatorCfg.password(data.password) ||
      !ValidatorCfg.minLength(data.password, 8) ||

      !ValidatorCfg.required(data.email) || 
      !ValidatorCfg.email(data.email) ||

      !ValidatorCfg.required(data.confirmPassword) ||
      data.password !== data.confirmPassword
    );
  }

  return isInvalid;
};

export default function AuthorizationForm({ onClose }: any) { {/* onClose - you can close outside */}
  useBlockScroll(true); 
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}> {/* do not close when clicking on the form */}
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}